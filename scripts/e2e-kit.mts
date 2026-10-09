/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test harness */
// Claim-kit journey (A§15) against a running app on testnet: owner names an heir by email →
// heir unlocks with the code → keeper notice → heir handover with no wallet → heir spends. ~3 min.
// Run: pnpm tsx scripts/e2e-kit.mts [baseUrl]   (reads CRON_SECRET from .env.local)
import { config } from "dotenv";
import { Asset, Horizon, Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildInheritedPayment, parseTx } from "../lib/core/builders";
import { generateClaimCode, newHeirKit, openKit, WrongCodeError } from "../lib/core/claimkit";
import { parsePacket, verifyPacket } from "../lib/core/packet";

config({ path: ".env.local", quiet: true });
const base = process.argv[2] ?? "http://localhost:3000";
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const W = 60;
let failures = 0;
const check = (label: string, ok: boolean, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` (${extra})` : ""}`); if (!ok) failures++; };
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const fund = async (kp: Keypair) => { for (let i = 0; i < 6; i++) { try { if ((await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)).ok) return; } catch { /* retry */ } await sleep(3); } throw new Error("friendbot"); };
const signXdr = (xdr: string, kp: Keypair) => { const t = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction; t.sign(kp); return t; };
const send = (tx: any) => horizon.submitTransaction(tx, { skipMemoRequiredCheck: true });
const tick = async (id: string) => (await (await fetch(`${base}/api/cron/tick?only=${id}`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).json()) as any;

const owner = Keypair.random(), exchange = Keypair.random(), fresh = Keypair.random();
console.log("Funding owner + an 'exchange' account…");
await Promise.all([fund(owner), fund(exchange)]);
const { xdr } = await (await fetch(`${base}/api/auth/challenge?address=${owner.publicKey()}`)).json();
const vr = await fetch(`${base}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr: signXdr(xdr, owner).toXDR() }) });
const cookie = (vr.headers.get("set-cookie") ?? "").split(";")[0];
const api = async (path: string, init: { method?: string; json?: unknown } = {}) => {
  const r = await fetch(`${base}${path}`, { method: init.method ?? "GET", headers: { cookie, "Content-Type": "application/json" }, body: init.json ? JSON.stringify(init.json) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) as any };
};

// Owner side: exactly what the wizard does in the browser.
const t0 = Date.now();
const { heirPublic, code, kit } = await newHeirKit(owner.publicKey());
console.log(`  kit created in ${Date.now() - t0} ms (600k PBKDF2 iterations)`);
const noEmail = await api("/api/plans", { method: "POST", json: { heir: heirPublic, heirKit: kit, inactivitySeconds: W, graceSeconds: W } });
check("kit heir requires an email", noEmail.status === 400, noEmail.body.error);
const draft = await api("/api/plans", { method: "POST", json: { heir: heirPublic, heirKit: kit, heirEmail: "heir@example.com", inactivitySeconds: W, graceSeconds: W } });
check("draft created for an heir key with no account", draft.status === 200, draft.body.error);
const setup = await send(signXdr(draft.body.setupXdr, owner));
let ok = false;
for (let i = 0; i < 6 && !ok; i++) { ok = (await api(`/api/plans/${draft.body.planId}/confirm`, { method: "POST", json: { txHash: setup.hash } })).status === 200; if (!ok) await sleep(2); }
check("plan armed", ok);
const planId = draft.body.planId;
check("dashboard shows a claim-kit heir", (await api(`/api/plans/${planId}`)).body.heirKind === "kit");

// Heir side: the public link from the email.
const pub = await (await fetch(`${base}/api/inherit/${planId}`)).json() as any;
const packet = parsePacket(pub.packet);
check("public inherit link returns a verified packet with the kit", verifyPacket(packet).length === 0 && !!packet.claimKit);
let wrong = false;
try { await openKit(packet.claimKit!, packet.owner, generateClaimCode()); } catch (e) { wrong = e instanceof WrongCodeError; }
check("a wrong claim code is rejected", wrong);
const heir = await openKit(packet.claimKit!, packet.owner, code.toUpperCase());
check("the right code unlocks the heir key", heir.publicKey() === heirPublic);
check("the public response never contains the heir secret", !JSON.stringify(pub).includes(heir.secret()));
const wallet404 = await fetch(`${base}/api/inherit/00000000-0000-0000-0000-000000000000`);
check("unknown inherit link → 404", wallet404.status === 404);

console.log(`waiting ${W + 8}s for the inactivity window…`); await sleep(W + 8);
// Either this tick or the production keeper (same database) may start it first; both are fine.
await tick(planId); await sleep(6); await tick(planId);
const afterNotice = (await api(`/api/plans/${planId}`)).body.state;
check("the keeper started the claim", afterNotice === "NOTICE" || afterNotice === "CLAIMABLE", afterNotice);
console.log(`waiting ${W + 5}s for the grace window…`); await sleep(W + 5);

// "Claim the inheritance": submitted with no wallet; the owner's account pays the fee.
const p2 = await send(parseTx("testnet", packet.phase2.xdr));
check("handover submitted without any wallet", !!p2.hash, p2.hash);
await sleep(3); await tick(planId);
check("plan is INHERITED", (await api(`/api/plans/${planId}`)).body.state === "INHERITED");

// The owner's account is now the heir's wallet.
const seq = async () => BigInt((await horizon.loadAccount(owner.publicKey())).sequenceNumber());
const create = buildInheritedPayment("testnet", owner.publicKey(), await seq(), fresh.publicKey(), Asset.native(), "100", { createDestination: true });
create.sign(heir);
const cr = await send(create);
const freshBal = (await horizon.loadAccount(fresh.publicKey())).balances.find((b) => b.asset_type === "native")?.balance;
check("heir sends 100 XLM to a brand-new address (account created)", !!cr.hash && freshBal === "100.0000000", freshBal);
const pay = buildInheritedPayment("testnet", owner.publicKey(), await seq(), exchange.publicKey(), Asset.native(), "2500", { memo: "123456789" });
pay.sign(heir);
const pr = await send(pay);
const memoTx = await (await fetch(`https://horizon-testnet.stellar.org/transactions/${pr.hash}`)).json() as any;
check("heir pays an exchange with a memo id", memoTx.memo_type === "id" && memoTx.memo === "123456789", `${memoTx.memo_type} ${memoTx.memo}`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll claim-kit checks passed");
process.exit(failures ? 1 : 0);

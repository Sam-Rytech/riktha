/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test harness */
// Full lifecycle against a running app on testnet: arm → keeper Phase 1 → NOTICE → CLAIMABLE →
// heir handover → INHERITED → estate payment; plus re-arm and revoke on a second owner. ~3 min.
// Run: pnpm tsx scripts/e2e-lifecycle.mts [baseUrl]   (reads CRON_SECRET from .env.local)
import { config } from "dotenv";
import { Asset, Horizon, Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildEstateTransfer, parseTx, wrapFeeBump } from "../lib/core/builders";

config({ path: ".env.local", quiet: true });
const base = process.argv[2] ?? "http://localhost:3000";
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const W = 60; // seconds, the testnet minimum
let failures = 0;
const check = (label: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
};
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const fund = async (kp: Keypair) => {
  for (let i = 0; i < 6; i++) { try { if ((await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)).ok) return; } catch { /* retry */ } await sleep(3); }
  throw new Error("friendbot failed");
};
const signXdr = (xdr: string, kp: Keypair) => { const t = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction; t.sign(kp); return t; };
async function session(kp: Keypair) {
  const { xdr } = await (await fetch(`${base}/api/auth/challenge?address=${kp.publicKey()}`)).json();
  const r = await fetch(`${base}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr: signXdr(xdr, kp).toXDR() }) });
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  return async (path: string, init: { method?: string; json?: unknown } = {}) => {
    const res = await fetch(`${base}${path}`, { method: init.method ?? "GET", headers: { cookie, "Content-Type": "application/json" }, body: init.json ? JSON.stringify(init.json) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) as any };
  };
}
const tick = async (planIds: string[]) => (await (await fetch(`${base}/api/cron/tick?only=${planIds.join(",")}`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).json()) as any;
const kinds = async (as: Awaited<ReturnType<typeof session>>, planId: string) =>
  ((await as("/api/notifications")).body.notifications ?? []).filter((n: any) => n.planId === planId).map((n: any) => n.kind);

async function arm(as: Awaited<ReturnType<typeof session>>, owner: Keypair, heir: Keypair, path = "/api/plans", json: any = { heir: heir.publicKey(), inactivitySeconds: W, graceSeconds: W }) {
  const d = await as(path, { method: "POST", json });
  if (d.status !== 200) throw new Error(`draft failed: ${JSON.stringify(d.body)}`);
  const res = await horizon.submitTransaction(signXdr(d.body.setupXdr, owner));
  for (let i = 0; i < 6; i++) {
    const c = await as(`/api/plans/${d.body.planId}/confirm`, { method: "POST", json: { txHash: res.hash } });
    if (c.status === 200) return d.body.planId as string;
    await sleep(2);
  }
  throw new Error("confirm failed");
}

const unauth = await fetch(`${base}/api/cron/tick`, { method: "POST", headers: { authorization: "Bearer nope" } });
check("cron endpoint rejects a wrong secret", unauth.status === 401);

const owner = Keypair.random(), heir = Keypair.random(), owner2 = Keypair.random();
console.log("Funding 3 accounts…");
await Promise.all([fund(owner), fund(heir), fund(owner2)]);
const asOwner = await session(owner), asHeir = await session(heir), asOwner2 = await session(owner2);

// ---- Lifecycle ----
const planId = await arm(asOwner, owner, heir);
check("plan armed", (await asOwner(`/api/plans/${planId}`)).body.state === "ARMED");
check("ARMED_OWNER in owner inbox", (await kinds(asOwner, planId)).includes("ARMED_OWNER"));
check("ARMED_HEIR in heir inbox", (await kinds(asHeir, planId)).includes("ARMED_HEIR"));

const early = await tick([planId]);
check("early tick submits nothing", early.submitted === 0, JSON.stringify(early));

console.log(`waiting ${W + 8}s for the inactivity window…`); await sleep(W + 8);
const t1 = await tick([planId]);
check("keeper submits Phase 1 when eligible", t1.submitted === 1, JSON.stringify(t1));
check("REMIND_95 sent once the window passed", (await kinds(asOwner, planId)).includes("REMIND_95"));
await sleep(6);
const t2 = await tick([planId]);
check("next tick records the NOTICE transition", t2.transitions === 1, JSON.stringify(t2));
check("plan is NOTICE", (await asHeir(`/api/plans/${planId}`)).body.state === "NOTICE");
check("NOTICE_OWNER (urgent) sent", (await kinds(asOwner, planId)).includes("NOTICE_OWNER"));
check("NOTICE_HEIR sent", (await kinds(asHeir, planId)).includes("NOTICE_HEIR"));
await tick([planId]); // may legitimately send GRACE_50 by now
const again = await tick([planId]);
check("an immediate re-run of a tick sends nothing twice", again.notified === 0, JSON.stringify(again));

console.log(`waiting ${W + 5}s for the grace window…`); await sleep(W + 5);
await tick([planId]);
const view = (await asHeir(`/api/plans/${planId}`)).body;
check("plan is CLAIMABLE", view.state === "CLAIMABLE", view.state);
check("CLAIMABLE_HEIR sent", (await kinds(asHeir, planId)).includes("CLAIMABLE_HEIR"));

// Heir completes the handover exactly as the browser does: fee-bump paid and signed by the heir.
const fb = wrapFeeBump("testnet", heir.publicKey(), parseTx("testnet", view.phase2Xdr));
fb.sign(heir);
const p2 = await horizon.submitTransaction(fb, { skipMemoRequiredCheck: true });
check("heir's fee-bumped Phase 2 accepted", !!p2.hash, p2.hash);
await sleep(3);
await tick([planId]);
check("plan is INHERITED", (await asHeir(`/api/plans/${planId}`)).body.state === "INHERITED");
check("INHERITED_OWNER + INHERITED_HEIR sent", (await kinds(asOwner, planId)).includes("INHERITED_OWNER") && (await kinds(asHeir, planId)).includes("INHERITED_HEIR"));
const heirView = (await asHeir(`/api/plans/${planId}`)).body;
check("heir now sees owner balances", Array.isArray(heirView.balances) && heirView.balances.length > 0);

const heirSeq = BigInt((await horizon.loadAccount(heir.publicKey())).sequenceNumber());
const pay = buildEstateTransfer("testnet", heir.publicKey(), heirSeq, owner.publicKey(), Asset.native(), "1000", heir.publicKey());
pay.sign(heir);
const payRes = await horizon.submitTransaction(pay, { skipMemoRequiredCheck: true });
check("heir moves 1000 XLM out of the owner account with only their own signature", !!payRes.hash, payRes.hash);

// ---- Re-arm and revoke ----
const planA = await arm(asOwner2, owner2, heir);
const planB = await arm(asOwner2, owner2, heir, `/api/plans/${planA}/rearm`, { inactivitySeconds: 2 * W });
const list = (await asOwner2("/api/plans")).body.plans;
check("re-arm replaces the old version", list.length === 1 && list[0].id === planB && list[0].version === 2, JSON.stringify(list.map((p: any) => [p.version, p.state])));
const signers = (await horizon.loadAccount(owner2.publicKey())).signers.filter((s) => s.type === "preauth_tx");
check("re-arm left exactly 2 pre-auth signers (stale pair removed)", signers.length === 2, String(signers.length));
const rv = await asOwner2(`/api/plans/${planB}/revoke`);
const rvRes = await horizon.submitTransaction(signXdr(rv.body.revokeXdr, owner2));
let rvc; for (let i = 0; i < 5; i++) { rvc = await asOwner2(`/api/plans/${planB}/revoke`, { method: "POST", json: { txHash: rvRes.hash } }); if (rvc.status === 200) break; await sleep(2); }
check("revoke confirmed", rvc!.body.state === "REVOKED", JSON.stringify(rvc!.body));
check("no Riktha signers left", (await horizon.loadAccount(owner2.publicKey())).signers.every((s) => s.type !== "preauth_tx"));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll lifecycle checks passed");
process.exit(failures ? 1 : 0);

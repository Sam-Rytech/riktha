/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test harness */
// End-to-end check of the plan API on testnet against a running app.
// Run: pnpm tsx scripts/e2e-plans.mts [baseUrl]
import { Horizon, Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { parsePacket, verifyPacket } from "../lib/core/packet";

const base = process.argv[2] ?? "http://localhost:3000";
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
let failures = 0;
const check = (label: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
};
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

async function fund(kp: Keypair) {
  for (let i = 0; i < 6; i++) {
    try { if ((await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)).ok) return; } catch { /* retry */ }
    await sleep(3);
  }
  throw new Error("friendbot failed");
}
const sign = (xdr: string, kp: Keypair) => {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  tx.sign(kp);
  return tx;
};
async function signIn(kp: Keypair): Promise<string> {
  const { xdr } = await (await fetch(`${base}/api/auth/challenge?address=${kp.publicKey()}`)).json();
  const r = await fetch(`${base}/api/auth/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr: sign(xdr, kp).toXDR() }),
  });
  return (r.headers.get("set-cookie") ?? "").split(";")[0];
}
const api = (cookie: string) => async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json", cookie, ...(init.headers ?? {}) } });
  const text = await r.text();
  let body: any; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, headers: r.headers };
};

const owner = Keypair.random(), heir = Keypair.random(), stranger = Keypair.random();
console.log("Funding owner + heir…");
await fund(owner); await fund(heir);
const asOwner = api(await signIn(owner));
const asHeir = api(await signIn(heir));
const asStranger = api(await signIn(stranger));

const unauth = await api("")("/api/plans");
check("plans API requires sign-in", unauth.status === 401, String(unauth.status));

const self = await asOwner("/api/plans", { method: "POST", body: JSON.stringify({ heir: owner.publicKey(), inactivitySeconds: 120, graceSeconds: 120 }) });
check("rejects heir == owner", self.status === 400 && /different/.test(self.body.error), self.body.error);

const ghost = await asOwner("/api/plans", { method: "POST", body: JSON.stringify({ heir: stranger.publicKey(), inactivitySeconds: 120, graceSeconds: 120 }) });
check("rejects an unfunded heir", ghost.status === 400 && /exist/.test(ghost.body.error), ghost.body.error);

const short = await asOwner("/api/plans", { method: "POST", body: JSON.stringify({ heir: heir.publicKey(), inactivitySeconds: 10, graceSeconds: 120 }) });
check("rejects a too-short window", short.status === 400, short.body.error);

const draft = await asOwner("/api/plans", { method: "POST", body: JSON.stringify({ heir: heir.publicKey(), inactivitySeconds: 120, graceSeconds: 120, heirEmail: "" }) });
check("creates a draft", draft.status === 200 && !!draft.body.setupXdr, draft.body.error);
check("draft explains 2 pre-approvals", draft.body.explain?.setup?.ops?.length === 2);
const planId = draft.body.planId;

const early = await asOwner(`/api/plans/${planId}/packet`);
check("no packet before arming", early.status === 409, String(early.status));

const wrongHash = await asOwner(`/api/plans/${planId}/confirm`, { method: "POST", body: JSON.stringify({ txHash: "ab".repeat(32) }) });
check("confirm rejects a foreign tx hash", wrongHash.status === 400, wrongHash.body.error);

const setup = sign(draft.body.setupXdr, owner);
const res = await horizon.submitTransaction(setup);
check("owner-signed setup accepted by testnet", !!res.hash, res.hash);

let confirm;
for (let i = 0; i < 5; i++) {
  confirm = await asOwner(`/api/plans/${planId}/confirm`, { method: "POST", body: JSON.stringify({ txHash: res.hash }) });
  if (confirm.status !== 409) break;
  await sleep(2);
}
check("confirm → ARMED", confirm!.status === 200 && confirm!.body.state === "ARMED", JSON.stringify(confirm!.body));

const again = await asOwner(`/api/plans/${planId}/confirm`, { method: "POST", body: JSON.stringify({ txHash: res.hash }) });
check("confirm is not repeatable", again.status === 409);

const got = await asOwner(`/api/plans/${planId}`);
check("owner sees live state ARMED + eligibleAt", got.body.state === "ARMED" && got.body.eligibleAt > Date.now() / 1000, `${got.body.state} ${got.body.eligibleAt}`);

const list = await asOwner("/api/plans");
check("owner list contains the plan", list.body.plans?.some((p: any) => p.id === planId));

const heirList = await asHeir("/api/heir/plans");
check("heir sees the plan under 'plans naming me'", heirList.body.plans?.some((p: any) => p.id === planId));
const heirView = await asHeir(`/api/plans/${planId}`);
check("heir view hides owner balances before handover", heirView.status === 200 && heirView.body.balances === undefined && heirView.body.heirEmail === undefined);

const strangerView = await asStranger(`/api/plans/${planId}`);
check("stranger gets 404", strangerView.status === 404, String(strangerView.status));

const packet = await asHeir(`/api/plans/${planId}/packet`);
check("packet downloads as an attachment", packet.status === 200 && /attachment/.test(packet.headers.get("content-disposition") ?? ""));
const problems = verifyPacket(parsePacket(packet.body));
check("downloaded packet passes verifyPacket", problems.length === 0, problems.join("; "));
check("packet hashes match what's on chain", (await horizon.loadAccount(owner.publicKey())).signers.filter((s) => s.type === "preauth_tx").length === 2);

console.log(`\nowner ${owner.publicKey()}\nplan ${planId}\nsetup https://stellar.expert/explorer/testnet/tx/${res.hash}`);
console.log(failures ? `\n${failures} check(s) failed` : "\nAll plan API checks passed");
process.exit(failures ? 1 : 0);

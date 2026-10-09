// A§11 test plan: 10 protocol scenarios on testnet → docs/evidence.json (rendered at /evidence).
// Run: pnpm scenarios   (~3 min; fresh friendbot accounts, I = G = 60 s)
import { writeFileSync } from "node:fs";
import {
  Asset, BASE_FEE, FeeBumpTransaction, Horizon, Keypair, Operation, Transaction, TransactionBuilder,
} from "@stellar/stellar-sdk";
import { buildCheckIn, buildEstateTransfer, buildPlan, buildRevoke, preauthSignerKey, wrapFeeBump } from "../lib/core/builders";
import { NETWORKS } from "../lib/core/config";

const NET = "testnet" as const;
const PASS = NETWORKS[NET].passphrase;
const server = new Horizon.Server(NETWORKS[NET].horizon);
const I = 60, G = 60;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const now = () => Math.floor(Date.now() / 1000);

interface Result { id: number; title: string; expected: string; passed: boolean; observed: string; txHashes: string[]; resultCodes?: unknown; at: string }
const results: Result[] = [];
function record(id: number, title: string, expected: string, passed: boolean, observed: string, txHashes: string[] = [], resultCodes?: unknown) {
  results.push({ id, title, expected, passed, observed, txHashes, resultCodes, at: new Date().toISOString() });
  console.log(`${passed ? "✅" : "❌"} S${id} ${title}: ${observed}`);
}

async function fund(kp: Keypair) {
  for (let i = 0; i < 6; i++) {
    try { if ((await fetch(`${NETWORKS[NET].friendbot}?addr=${kp.publicKey()}`)).ok) return; } catch { /* retry */ }
    await sleep(3);
  }
  throw new Error("friendbot failed");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (pk: string) => server.accounts().accountId(pk).call() as Promise<any>;
const seqOf = async (pk: string) => BigInt((await raw(pk)).sequence);
const preauthKeys = async (pk: string) => ((await raw(pk)).signers as { key: string; type: string }[]).filter((s) => s.type === "preauth_tx").map((s) => s.key);

async function send(tx: Transaction | FeeBumpTransaction): Promise<{ ok: true; hash: string } | { ok: false; codes: { transaction?: string; inner_transaction?: string; operations?: string[] } }> {
  try {
    return { ok: true, hash: (await server.submitTransaction(tx, { skipMemoRequiredCheck: true })).hash };
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const codes = (e as any)?.response?.data?.extras?.result_codes;
    if (!codes) throw e;
    return { ok: false, codes };
  }
}
const innerCode = (c: { transaction?: string; inner_transaction?: string }) => c.inner_transaction ?? c.transaction;
const fb = (inner: Transaction, payer: Keypair) => { const f = wrapFeeBump(NET, payer.publicKey(), inner); f.sign(payer); return f; };
const signed = <T extends Transaction>(tx: T, kp: Keypair) => { tx.sign(kp); return tx; };

async function untilTime(t: number, label: string) {
  const wait = t - now();
  if (wait > 0) { console.log(`  … waiting ${wait}s (${label})`); await sleep(wait); }
}

/** Flow A: S1, S2, S3, S4, S5, S8, S9. */
async function flowA(owner: Keypair, heir: Keypair, keeper: Keypair, issuer: Keypair) {
  // Give the owner a test asset so S9 can move a non-XLM balance.
  const RIK = new Asset("RIK", issuer.publicKey());
  const trust = new TransactionBuilder(await server.loadAccount(owner.publicKey()), { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.changeTrust({ asset: RIK })).setTimeout(300).build();
  await send(signed(trust, owner));
  const issue = new TransactionBuilder(await server.loadAccount(issuer.publicKey()), { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.payment({ destination: owner.publicKey(), asset: RIK, amount: "250" })).setTimeout(300).build();
  await send(signed(issue, issuer));

  const plan = buildPlan({ network: NET, owner: owner.publicKey(), heir: heir.publicKey(), inactivitySeconds: I, graceSeconds: G, variant: "plain", weight: 1, currentSeq: await seqOf(owner.publicKey()), stalePreauthHashes: [] });
  const before = (await raw(owner.publicKey())).sequence_time ?? "absent";
  const setup = await send(signed(plan.setup, owner));
  const a1 = await raw(owner.publicKey());
  const keys = await preauthKeys(owner.publicKey());
  const expected = [preauthSignerKey(plan.phase1Hash), preauthSignerKey(plan.phase2Hash)];
  const setupTime = Number(a1.sequence_time);
  record(1, "Setup registers two pre-authorized transactions", "Success; 2 preauth_tx signers with expected hashes; sequence_time updated",
    setup.ok && expected.every((k) => keys.includes(k)) && keys.length === 2 && String(setupTime) !== before,
    `${keys.length} pre-auth signers, hashes match: ${expected.every((k) => keys.includes(k))}; sequence_time ${before} → ${setupTime}`, setup.ok ? [setup.hash] : []);

  const early = await send(fb(plan.phase1, keeper));
  const stillThere = (await preauthKeys(owner.publicKey())).length === 2;
  record(2, "Phase 1 submitted early is rejected harmlessly", "Rejected: tx_bad_minseq_age_or_gap; pre-auth signer still present",
    !early.ok && innerCode(early.codes) === "tx_bad_minseq_age_or_gap" && stillThere,
    `${early.ok ? "accepted?!" : JSON.stringify(early.codes)}; signers intact: ${stillThere}`, [], early.ok ? undefined : early.codes);

  await untilTime(setupTime + Math.floor(I / 2), "half the window, then the owner checks in");
  const ci = await send(signed(buildCheckIn(NET, owner.publicKey(), await seqOf(owner.publicKey())), owner));
  const checkInTime = Number((await raw(owner.publicKey())).sequence_time);
  await untilTime(setupTime + I + 5, "original deadline");
  const afterReset = await send(fb(plan.phase1, keeper));
  record(3, "An owner check-in resets the clock", "Phase 1 still rejected at the original deadline",
    ci.ok && !afterReset.ok && innerCode(afterReset.codes) === "tx_bad_minseq_age_or_gap",
    `check-in ${ci.ok ? "ok" : "failed"}; Phase 1 at original deadline: ${afterReset.ok ? "accepted?!" : innerCode(afterReset.codes)}`, ci.ok ? [ci.hash] : [], afterReset.ok ? undefined : afterReset.codes);

  await untilTime(checkInTime + I + 5, "inactivity window after the check-in");
  const p1 = await send(fb(plan.phase1, keeper));
  const s = await seqOf(owner.publicKey());
  record(4, "Phase 1 after the inactivity window", "Success; account sequence == s1",
    p1.ok && s === plan.phase1Seq, `${p1.ok ? "accepted" : JSON.stringify(p1.codes)}; seq ${s} vs s1 ${plan.phase1Seq}`, p1.ok ? [p1.hash] : []);
  const noticeTime = Number((await raw(owner.publicKey())).sequence_time);

  const p2early = await send(fb(plan.phase2, heir));
  record(5, "Phase 2 submitted early is rejected", "Rejected: tx_bad_minseq_age_or_gap",
    !p2early.ok && innerCode(p2early.codes) === "tx_bad_minseq_age_or_gap", p2early.ok ? "accepted?!" : JSON.stringify(p2early.codes), [], p2early.ok ? undefined : p2early.codes);

  await untilTime(noticeTime + G + 5, "grace window");
  const p2 = await send(fb(plan.phase2, heir));
  const heirSigner = ((await raw(owner.publicKey())).signers as { key: string; weight: number }[]).find((x) => x.key === heir.publicKey());
  record(8, "Full path: Phase 1 → grace → Phase 2", "Heir is a signer with weight W",
    p2.ok && heirSigner?.weight === 1, `${p2.ok ? "accepted" : JSON.stringify(p2.codes)}; heir weight ${heirSigner?.weight ?? "none"}`, p2.ok ? [p2.hash] : []);

  const xlm = await send(signed(buildEstateTransfer(NET, heir.publicKey(), await seqOf(heir.publicKey()), owner.publicKey(), Asset.native(), "100", heir.publicKey()), heir));
  const rik = await send(signed(buildEstateTransfer(NET, heir.publicKey(), await seqOf(heir.publicKey()), owner.publicKey(), RIK, "250", heir.publicKey(), { addTrustline: true }), heir));
  const heirRik = ((await raw(heir.publicKey())).balances as { asset_code?: string; balance: string }[]).find((b) => b.asset_code === "RIK")?.balance;
  record(9, "Heir moves XLM and a test asset out of the owner's account", "Payments succeed with the heir's signature only",
    xlm.ok && rik.ok && heirRik === "250.0000000", `XLM ${xlm.ok ? "moved" : JSON.stringify(xlm.codes)}; RIK ${rik.ok ? "moved (trustline added)" : JSON.stringify(rik.codes)}; heir RIK balance ${heirRik}`,
    [xlm, rik].flatMap((r) => (r.ok ? [r.hash] : [])));
}

/** Flow B: S6, S7, S10. */
async function flowB(owner: Keypair, heir: Keypair, keeper: Keypair) {
  const plan = buildPlan({ network: NET, owner: owner.publicKey(), heir: heir.publicKey(), inactivitySeconds: I, graceSeconds: G, variant: "plain", weight: 1, currentSeq: await seqOf(owner.publicKey()), stalePreauthHashes: [] });
  const setup = await send(signed(plan.setup, owner));
  if (!setup.ok) throw new Error("flow B setup failed");
  await untilTime(Number((await raw(owner.publicKey())).sequence_time) + I + 5, "flow B inactivity window");
  const p1 = await send(fb(plan.phase1, keeper));
  const cancel = await send(signed(buildCheckIn(NET, owner.publicKey(), await seqOf(owner.publicKey())), owner));
  await untilTime(now() + G + 5, "past the grace window, to show the cancel is permanent");
  const p2 = await send(fb(plan.phase2, heir));
  record(6, "Owner cancels during the grace window", "Owner tx succeeds; Phase 2 then rejected with tx_bad_seq forever",
    p1.ok && cancel.ok && !p2.ok && innerCode(p2.codes) === "tx_bad_seq",
    `Phase 1 ${p1.ok ? "ok" : "failed"}; cancel ${cancel.ok ? "ok" : "failed"}; Phase 2 after grace: ${p2.ok ? "accepted?!" : innerCode(p2.codes)}`,
    [p1, cancel].flatMap((r) => (r.ok ? [r.hash] : [])), p2.ok ? undefined : p2.codes);

  // Re-arm: Phase 1's signer was consumed; Phase 2's is stale and must be removed.
  const re = buildPlan({ network: NET, owner: owner.publicKey(), heir: heir.publicKey(), inactivitySeconds: I, graceSeconds: G, variant: "plain", weight: 1, currentSeq: await seqOf(owner.publicKey()), stalePreauthHashes: [plan.phase2Hash] });
  const rearm = await send(signed(re.setup, owner));
  const keys = await preauthKeys(owner.publicKey());
  const fresh = [preauthSignerKey(re.phase1Hash), preauthSignerKey(re.phase2Hash)];
  record(7, "Re-arm after a cancelled claim", "Stale signers removed, new pair present",
    rearm.ok && keys.length === 2 && fresh.every((k) => keys.includes(k)) && !keys.includes(preauthSignerKey(plan.phase2Hash)),
    `${keys.length} pre-auth signers; new pair present: ${fresh.every((k) => keys.includes(k))}; stale removed: ${!keys.includes(preauthSignerKey(plan.phase2Hash))}`, rearm.ok ? [rearm.hash] : []);

  const rv = await send(signed(buildRevoke(NET, owner.publicKey(), await seqOf(owner.publicKey()), [re.phase1Hash, re.phase2Hash]), owner));
  const left = await preauthKeys(owner.publicKey());
  record(10, "Revoke", "No Riktha signers left", rv.ok && left.length === 0, `${rv.ok ? "ok" : JSON.stringify(rv.codes)}; ${left.length} pre-auth signers left`, rv.ok ? [rv.hash] : []);
}

async function main() {
  const [ownerA, heirA, ownerB, heirB, keeper, issuer] = Array.from({ length: 6 }, () => Keypair.random());
  console.log("Funding 6 testnet accounts…");
  for (const k of [ownerA, heirA, ownerB, heirB, keeper, issuer]) await fund(k);
  await sleep(6);
  const started = new Date().toISOString();
  await Promise.all([flowA(ownerA, heirA, keeper, issuer), flowB(ownerB, heirB, keeper)]);
  results.sort((a, b) => a.id - b.id);
  const out = {
    generatedAt: new Date().toISOString(), startedAt: started, network: NET, windows: { inactivitySeconds: I, graceSeconds: G },
    accounts: { ownerA: ownerA.publicKey(), heirA: heirA.publicKey(), ownerB: ownerB.publicKey(), heirB: heirB.publicKey(), keeper: keeper.publicKey(), assetIssuer: issuer.publicKey() },
    passed: results.filter((r) => r.passed).length, total: results.length, scenarios: results,
  };
  writeFileSync("docs/evidence.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`\n${out.passed}/${out.total} passed → docs/evidence.json`);
  process.exit(out.passed === out.total ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });

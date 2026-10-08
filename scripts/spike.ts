// T0.2 protocol spike (ARCHITECTURE Appendix A, extended).
// Run: pnpm tsx scripts/spike.ts   (testnet, ~3 min; writes scripts/spike-results.json)
import { writeFileSync } from "node:fs";
import {
  Horizon, Keypair, Account, TransactionBuilder, Operation, Memo, Asset,
  Networks, BASE_FEE, TimeoutInfinite, Transaction, FeeBumpTransaction,
} from "@stellar/stellar-sdk";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const PASS = Networks.TESTNET;
const I = 60, G = 60; // seconds
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const results: Record<string, unknown> = {};
const record = (k: string, v: unknown) => { results[k] = v; console.log(`  ↳ ${k}:`, JSON.stringify(v)); };

async function fund(kp: Keypair) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
      if (r.ok) return;
      console.log(`  friendbot ${r.status}, retrying…`);
    } catch (e) {
      console.log(`  friendbot error (${(e as Error).message}), retrying…`);
    }
    await sleep(3 * (i + 1));
  }
  throw new Error("friendbot failed for " + kp.publicKey());
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (pk: string) => server.accounts().accountId(pk).call() as Promise<any>;

async function submit(label: string, tx: Transaction | FeeBumpTransaction) {
  try {
    const res = await server.submitTransaction(tx);
    console.log(`✅ ${label}: ${res.hash}`);
    return { ok: true as const, hash: res.hash };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const codes = (e as any)?.response?.data?.extras?.result_codes ?? String(e);
    console.log(`❌ ${label}:`, JSON.stringify(codes));
    return { ok: false as const, codes };
  }
}

function build(src: string, seq: bigint, ops: ReturnType<typeof Operation.bumpSequence>[], memo: string,
  pre: (b: TransactionBuilder) => void = () => {}) {
  const b = new TransactionBuilder(new Account(src, (seq - 1n).toString()), { fee: BASE_FEE, networkPassphrase: PASS });
  ops.forEach((o) => b.addOperation(o));
  b.addMemo(Memo.text(memo));
  pre(b);
  return b.setTimeout(TimeoutInfinite).build();
}

const fb = (inner: Transaction, payer: Keypair) => {
  const f = TransactionBuilder.buildFeeBumpTransaction(payer, "1000", inner, PASS);
  f.sign(payer);
  return f;
};

async function setupPlan(owner: Keypair, p1: Transaction, p2: Transaction) {
  const setup = new TransactionBuilder(await server.loadAccount(owner.publicKey()), { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.setOptions({ signer: { preAuthTx: p1.hash(), weight: 1 } }))
    .addOperation(Operation.setOptions({ signer: { preAuthTx: p2.hash(), weight: 1 } }))
    .setTimeout(300).build();
  setup.sign(owner);
  return submit("setup", setup);
}

// SP1: largest accepted seq jump. Owner signs directly, so no wait is needed.
async function probeSeqJump(probe: Keypair) {
  const jumps = [1_000_000_000n, 1n << 31n, 1n << 28n, 1n << 24n];
  for (const J of jumps) {
    const a = await raw(probe.publicKey());
    const S = BigInt(a.sequence);
    const tx = build(probe.publicKey(), S + 1n + J, [Operation.bumpSequence({ bumpTo: "0" })], "riktha:probe",
      (b) => b.setMinAccountSequence(S.toString()));
    tx.sign(probe);
    const r = await submit(`SP1 probe jump ${J}`, tx);
    if (r.ok) return { acceptedJump: J.toString(), hash: r.hash };
    record(`SP1_reject_${J}`, r.codes);
  }
  return { acceptedJump: null };
}

// Flow A: sponsored Phase 2, everything fee-bumped (SP2, SP3, SP5).
async function flowSponsored(owner: Keypair, heir: Keypair, keeper: Keypair) {
  const a0 = await raw(owner.publicKey());
  record("SP2_before", { sequence_time: a0.sequence_time, sequence_ledger: a0.sequence_ledger });
  const C = BigInt(a0.sequence), X = C + 1n, s1 = X + 1_000_000_000n, s2 = s1 + 1n;

  const p1 = build(owner.publicKey(), s1, [Operation.bumpSequence({ bumpTo: "0" })], "riktha:notice",
    (b) => b.setMinAccountSequence(X.toString()).setMinAccountSequenceAge(BigInt(I)));
  const p2 = build(owner.publicKey(), s2, [
    Operation.beginSponsoringFutureReserves({ sponsoredId: owner.publicKey(), source: heir.publicKey() }),
    Operation.setOptions({ signer: { ed25519PublicKey: heir.publicKey(), weight: 1 } }),
    Operation.endSponsoringFutureReserves({ source: owner.publicKey() }),
  ] as never, "riktha:handover", (b) => b.setMinAccountSequenceAge(BigInt(G)));

  // Saved for the SP6/SP7 Freighter page (unsigned PreconditionsV2 inner XDR).
  results.sampleUnsignedPhase2Xdr = p2.toXDR();

  record("A_setup", await setupPlan(owner, p1, p2));
  const a1 = await raw(owner.publicKey());
  record("SP2_after", { sequence_time: a1.sequence_time, signers: a1.signers.map((s: { type: string }) => s.type) });

  record("SP5_phase1_early_feebump", await submit("SP5 phase1 EARLY (fee-bump)", fb(p1, keeper)));
  const a2 = await raw(owner.publicKey());
  record("A_preauth_after_early", a2.signers.filter((s: { type: string }) => s.type === "preauth_tx").length);

  console.log(`[A] waiting ${I + 10}s for inactivity window…`); await sleep(I + 10);
  record("SP1_phase1_after_window", await submit("[A] phase1 after window (fee-bump)", fb(p1, keeper)));
  const a3 = await raw(owner.publicKey());
  record("A_seq_after_phase1", { seq: a3.sequence, expected_s1: s1.toString(), sequence_time: a3.sequence_time });

  const p2Signed = TransactionBuilder.fromXDR(p2.toXDR(), PASS) as Transaction;
  p2Signed.sign(heir);
  record("A_phase2_early", await submit("[A] phase2 EARLY", fb(p2Signed, heir)));

  console.log(`[A] waiting ${G + 10}s for grace window…`); await sleep(G + 10);
  record("SP3_phase2_sponsored", await submit("SP3 phase2 sponsored", fb(p2Signed, heir)));
  const a4 = await raw(owner.publicKey());
  record("A_final", { signers: a4.signers, num_sponsored: a4.num_sponsored, seq: a4.sequence });
}

// Flow B: plain Phase 2 at exact minimum balance (SP4); Phase 1 submitted WITHOUT fee-bump (fallback).
async function flowPlain(owner: Keypair, heir: Keypair) {
  const a0 = await raw(owner.publicKey());
  const C = BigInt(a0.sequence), X = C + 1n, s1 = X + 1_000_000_000n, s2 = s1 + 1n;
  const p1 = build(owner.publicKey(), s1, [Operation.bumpSequence({ bumpTo: "0" })], "riktha:notice",
    (b) => b.setMinAccountSequence(X.toString()).setMinAccountSequenceAge(BigInt(I)));
  const p2 = build(owner.publicKey(), s2,
    [Operation.setOptions({ signer: { ed25519PublicKey: heir.publicKey(), weight: 1 } })] as never,
    "riktha:handover", (b) => b.setMinAccountSequenceAge(BigInt(G)));
  record("B_setup", await setupPlan(owner, p1, p2));

  // Early inner-only submission (no fee-bump) — should fail before application, signer kept.
  record("B_phase1_early_inner", await submit("[B] phase1 EARLY (inner only)", p1));
  console.log(`[B] waiting ${I + 10}s…`); await sleep(I + 10);
  record("B_phase1_inner_only", await submit("[B] phase1 after window (inner only, owner pays fee)", p1));

  // Report balance vs minimum before Phase 2 (the exact-minimum case is covered by flowPlainMinBalance).
  const a1 = await raw(owner.publicKey());
  const ledger = await server.ledgers().order("desc").limit(1).call();
  const reserve = BigInt(ledger.records[0].base_reserve_in_stroops);
  const native = a1.balances.find((b: { asset_type: string }) => b.asset_type === "native");
  const balStroops = BigInt(Math.round(Number(native.balance) * 1e7));
  const minStroops = (2n + BigInt(a1.subentry_count) + BigInt(a1.num_sponsoring) - BigInt(a1.num_sponsored)) * reserve;
  record("B_balance_before_phase2", { balStroops: balStroops.toString(), minStroops: minStroops.toString() });

  console.log(`[B] waiting ${G + 10}s…`); await sleep(G + 10);
  // Plain variant: NO inner signature. Fee-bump paid by heir.
  record("B_phase2_plain", await submit("[B] phase2 plain", fb(p2, heir)));
  const a2 = await raw(owner.publicKey());
  record("B_final", { signers: a2.signers, seq: a2.sequence });
}

// SP4: plain Phase 2 when the owner sits at exact minimum balance.
// The owner drains BEFORE setup (setup then adds 2 signers, so the owner must keep 2 reserves + fees).
// Sequence: fund → drain to (min with 2 signers + setup fee + phase1 handled by fee-bump) → setup → P1 → P2.
async function flowPlainMinBalance(owner: Keypair, heir: Keypair, keeper: Keypair) {
  const ledger = await server.ledgers().order("desc").limit(1).call();
  const reserve = BigInt(ledger.records[0].base_reserve_in_stroops);
  // After setup: subentries = 2 → min = 4 reserves. Setup fee = 200 stroops; drain fee = 100.
  const a = await raw(owner.publicKey());
  const native = a.balances.find((b: { asset_type: string }) => b.asset_type === "native");
  const bal = BigInt(Math.round(Number(native.balance) * 1e7));
  const keep = 4n * reserve + 200n;
  const drain = bal - keep - 100n;
  const amount = (Number(drain) / 1e7).toFixed(7);
  const drainTx = new TransactionBuilder(await server.loadAccount(owner.publicKey()), { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.payment({ destination: keeper.publicKey(), asset: Asset.native(), amount }))
    .setTimeout(300).build();
  drainTx.sign(owner);
  record("SP4_drain", await submit("SP4 drain owner", drainTx));

  const a0 = await raw(owner.publicKey());
  const C = BigInt(a0.sequence), X = C + 1n, s1 = X + 1_000_000_000n, s2 = s1 + 1n;
  const p1 = build(owner.publicKey(), s1, [Operation.bumpSequence({ bumpTo: "0" })], "riktha:notice",
    (b) => b.setMinAccountSequence(X.toString()).setMinAccountSequenceAge(BigInt(I)));
  const p2 = build(owner.publicKey(), s2,
    [Operation.setOptions({ signer: { ed25519PublicKey: heir.publicKey(), weight: 1 } })] as never,
    "riktha:handover", (b) => b.setMinAccountSequenceAge(BigInt(G)));
  record("SP4_setup", await setupPlan(owner, p1, p2));
  const a1 = await raw(owner.publicKey());
  record("SP4_balance_after_setup", a1.balances.find((b: { asset_type: string }) => b.asset_type === "native").balance);

  console.log(`[SP4] waiting ${I + 10}s…`); await sleep(I + 10);
  record("SP4_phase1", await submit("[SP4] phase1 (fee-bump)", fb(p1, keeper)));
  console.log(`[SP4] waiting ${G + 10}s…`); await sleep(G + 10);
  record("SP4_phase2_plain_at_min", await submit("SP4 phase2 plain at min balance", fb(p2, heir)));
  const a2 = await raw(owner.publicKey());
  record("SP4_final", { signers: a2.signers.map((s: { key: string; type: string }) => s.type), balances: a2.balances });
}

async function main() {
  const kp = () => Keypair.random();
  const [ownerA, heirA, keeper, ownerB, heirB, ownerC, heirC, probe] = [kp(), kp(), kp(), kp(), kp(), kp(), kp(), kp()];
  console.log("Funding 8 accounts via friendbot…");
  for (const k of [ownerA, heirA, keeper, ownerB, heirB, ownerC, heirC, probe]) await fund(k);
  results.accounts = { ownerA: ownerA.publicKey(), heirA: heirA.publicKey(), keeper: keeper.publicKey(),
    ownerB: ownerB.publicKey(), heirB: heirB.publicKey(), ownerC: ownerC.publicKey(), heirC: heirC.publicKey() };
  await sleep(6); // let a few ledgers close (SP1)

  record("SP1_probe", await probeSeqJump(probe));
  await Promise.all([
    flowSponsored(ownerA, heirA, keeper),
    flowPlain(ownerB, heirB),
    flowPlainMinBalance(ownerC, heirC, keeper),
  ]);
  writeFileSync("scripts/spike-results.json", JSON.stringify(results, null, 2));
  console.log("\nWrote scripts/spike-results.json");
}
main().catch((e) => { console.error(e); process.exit(1); });

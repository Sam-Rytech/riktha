import {
  Account, Asset, BASE_FEE, FeeBumpTransaction, Memo, Operation, TimeoutInfinite, Transaction,
  StrKey, TransactionBuilder,
} from "@stellar/stellar-sdk";
import { FEE_BUMP_BASE_FEE, MEMOS, NETWORKS, NetworkName, SEQ_JUMP, SIGN_TIMEOUT_SECONDS } from "./config";

export type Variant = "sponsored" | "plain";

export interface PlanParams {
  network: NetworkName;
  owner: string;
  heir: string;
  inactivitySeconds: number;
  graceSeconds: number;
  variant: Variant;
  weight: number;
  /** C: the owner's current sequence number. */
  currentSeq: bigint;
  /** Hex hashes of stale Riktha pre-auth signers to remove in the same setup tx. */
  stalePreauthHashes: string[];
}

export interface BuiltPlan {
  baseSeq: bigint;   // X
  phase1Seq: bigint; // s1
  phase2Seq: bigint; // s2
  phase1: Transaction;
  phase2: Transaction;
  setup: Transaction;
  phase1Hash: string;
  phase2Hash: string;
}

const passphrase = (network: NetworkName) => NETWORKS[network].passphrase;

/** A builder whose next tx has sequence `seq` (the builder increments the account's sequence). */
function builderAt(network: NetworkName, source: string, seq: bigint) {
  return new TransactionBuilder(new Account(source, (seq - 1n).toString()), {
    fee: BASE_FEE,
    networkPassphrase: passphrase(network),
  });
}

const removePreauth = (hashHex: string) =>
  Operation.setOptions({ signer: { preAuthTx: Buffer.from(hashHex, "hex"), weight: 0 } });

export function buildPhase1(network: NetworkName, owner: string, baseSeq: bigint, inactivitySeconds: number): Transaction {
  return builderAt(network, owner, baseSeq + SEQ_JUMP)
    .addOperation(Operation.bumpSequence({ bumpTo: "0" }))
    .addMemo(Memo.text(MEMOS.notice))
    .setMinAccountSequence(baseSeq.toString())
    .setMinAccountSequenceAge(BigInt(inactivitySeconds))
    .setTimeout(TimeoutInfinite)
    .build();
}

export function buildPhase2(
  network: NetworkName, owner: string, heir: string, phase1Seq: bigint,
  graceSeconds: number, variant: Variant, weight: number,
): Transaction {
  const b = builderAt(network, owner, phase1Seq + 1n);
  const addHeir = Operation.setOptions({ signer: { ed25519PublicKey: heir, weight } });
  if (variant === "sponsored") {
    b.addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: owner, source: heir }))
      .addOperation(addHeir)
      .addOperation(Operation.endSponsoringFutureReserves({ source: owner }));
  } else {
    b.addOperation(addHeir);
  }
  // No minSeqNum: Phase 2 requires the account sequence to be exactly s1.
  return b.addMemo(Memo.text(MEMOS.handover))
    .setMinAccountSequenceAge(BigInt(graceSeconds))
    .setTimeout(TimeoutInfinite)
    .build();
}

export function buildPlan(p: PlanParams): BuiltPlan {
  if (p.weight < 1 || p.weight > 255) throw new Error("weight must be 1..255");
  if (p.owner === p.heir) throw new Error("heir must differ from owner");
  const baseSeq = p.currentSeq + 1n;
  const phase1 = buildPhase1(p.network, p.owner, baseSeq, p.inactivitySeconds);
  const phase1Seq = baseSeq + SEQ_JUMP;
  const phase2 = buildPhase2(p.network, p.owner, p.heir, phase1Seq, p.graceSeconds, p.variant, p.weight);
  const phase1Hash = txHashHex(phase1);
  const phase2Hash = txHashHex(phase2);

  const b = builderAt(p.network, p.owner, baseSeq);
  for (const h of p.stalePreauthHashes) b.addOperation(removePreauth(h));
  b.addOperation(Operation.setOptions({ signer: { preAuthTx: phase1.hash(), weight: p.weight } }))
    .addOperation(Operation.setOptions({ signer: { preAuthTx: phase2.hash(), weight: p.weight } }));
  const setup = b.setTimeout(SIGN_TIMEOUT_SECONDS).build();

  return { baseSeq, phase1Seq, phase2Seq: phase1Seq + 1n, phase1, phase2, setup, phase1Hash, phase2Hash };
}

/** Removes every given Riktha pre-auth signer. */
export function buildRevoke(network: NetworkName, owner: string, currentSeq: bigint, hashes: string[]): Transaction {
  if (hashes.length === 0) throw new Error("nothing to revoke");
  const b = builderAt(network, owner, currentSeq + 1n);
  hashes.forEach((h) => b.addOperation(removePreauth(h)));
  return b.setTimeout(SIGN_TIMEOUT_SECONDS).build();
}

/** "I'm alive": a no-op the owner signs; any other sent tx works the same. */
export function buildCheckIn(network: NetworkName, owner: string, currentSeq: bigint): Transaction {
  return builderAt(network, owner, currentSeq + 1n)
    .addOperation(Operation.bumpSequence({ bumpTo: "0" }))
    .addMemo(Memo.text(MEMOS.alive))
    .setTimeout(SIGN_TIMEOUT_SECONDS)
    .build();
}

/**
 * After handover: the heir (tx source, pays the fee) moves an asset out of the owner account
 * (op source). Set `addTrustline` when the destination is the heir and it has no trustline yet.
 */
export function buildEstateTransfer(
  network: NetworkName, heir: string, heirSeq: bigint, owner: string,
  asset: Asset, amount: string, destination: string, opts: { addTrustline?: boolean } = {},
): Transaction {
  const b = builderAt(network, heir, heirSeq + 1n);
  if (opts.addTrustline && !asset.isNative()) {
    b.addOperation(Operation.changeTrust({ asset, source: destination }));
  }
  b.addOperation(Operation.payment({ destination, asset, amount, source: owner }));
  return b.setTimeout(SIGN_TIMEOUT_SECONDS).build();
}

/**
 * Claim-kit heirs have no account of their own (A§15): after handover they spend straight from the
 * owner's account (tx source = owner, fee from its balance), signing with the heir key.
 * `createDestination` sends XLM with CreateAccount when the destination doesn't exist yet.
 */
export function buildInheritedPayment(
  network: NetworkName, owner: string, ownerSeq: bigint, destination: string, asset: Asset, amount: string,
  opts: { memo?: string; createDestination?: boolean } = {},
): Transaction {
  if (opts.createDestination && !asset.isNative()) throw new Error("only XLM can create a new account");
  const b = builderAt(network, owner, ownerSeq + 1n);
  b.addOperation(opts.createDestination
    ? Operation.createAccount({ destination, startingBalance: amount })
    : Operation.payment({ destination, asset, amount }));
  if (opts.memo) b.addMemo(/^\d{1,19}$/.test(opts.memo) ? Memo.id(opts.memo) : Memo.text(opts.memo));
  return b.setTimeout(SIGN_TIMEOUT_SECONDS).build();
}

/** Unsigned fee-bump; the fee source signs it. */
export function wrapFeeBump(
  network: NetworkName, feeSource: string, inner: Transaction, baseFee: string = FEE_BUMP_BASE_FEE,
): FeeBumpTransaction {
  return TransactionBuilder.buildFeeBumpTransaction(feeSource, baseFee, inner, passphrase(network));
}

export function parseTx(network: NetworkName, envelopeXdr: string): Transaction {
  const tx = TransactionBuilder.fromXDR(envelopeXdr, passphrase(network));
  if (tx instanceof FeeBumpTransaction) throw new Error("expected a plain transaction, got a fee-bump");
  return tx;
}

/** SDK 17 returns Uint8Array from tx.hash(), so Buffer#toString("hex") must be explicit. */
export function txHashHex(tx: Transaction | FeeBumpTransaction): string {
  return Buffer.from(tx.hash()).toString("hex");
}

/** Text memo as a string (SDK 17 gives Uint8Array for text memos), or undefined. */
export function memoText(tx: Transaction): string | undefined {
  const v = tx.memo.value;
  if (v == null) return undefined;
  return typeof v === "string" ? v : Buffer.from(v as Uint8Array).toString("utf8");
}

/** Hex hash -> `T…` StrKey as Horizon lists pre-auth signers. */
export function preauthSignerKey(hashHex: string): string {
  return StrKey.encodePreAuthTx(Buffer.from(hashHex, "hex"));
}

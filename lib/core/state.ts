import { preauthSignerKey, Variant } from "./builders";

/** 0.001 XLM: comfortably covers a 3-op transaction at base fee. */
const OWNER_FEE_MARGIN_STROOPS = 10_000n;

/** The subset of a Horizon account record that Riktha reads (raw JSON, so numbers are strings). */
export interface HorizonAccount {
  account_id: string;
  sequence: string;
  sequence_time?: string;
  signers: { key: string; weight: number; type: string }[];
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  balances: { asset_type: string; balance: string; selling_liabilities?: string; asset_code?: string; asset_issuer?: string }[];
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
}

export interface PlanOnChainRef {
  heir: string;
  variant: Variant;
  baseSeq: bigint;
  phase1Seq: bigint;
  phase1Hash: string;
  phase2Hash: string;
  inactivitySeconds: number;
  graceSeconds: number;
}

export type PlanState =
  | "DRAFT" | "ARMED" | "ELIGIBLE" | "NOTICE" | "CLAIMABLE"
  | "INHERITED" | "CANCELLED" | "REVOKED" | "BROKEN";

export interface DerivedState {
  state: PlanState;
  seq: bigint;
  seqTime: number;
  eligibleAt?: number;
  claimableAt?: number;
  /** Owner can pay a Phase 1/2 fee itself, so the tx can be submitted without a fee-bump. */
  ownerCanPayFee: boolean;
  diagnostics: string[];
}

const toStroops = (amount: string) => {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole) * 10_000_000n + BigInt((frac + "0000000").slice(0, 7));
};

export function minimumBalanceStroops(a: HorizonAccount, baseReserveStroops: bigint): bigint {
  const entries = 2n + BigInt(a.subentry_count) + BigInt(a.num_sponsoring ?? 0) - BigInt(a.num_sponsored ?? 0);
  return entries * baseReserveStroops;
}

/** Native XLM the account can spend right now (balance − minimum − selling liabilities). */
export function availableXlmStroops(a: HorizonAccount, baseReserveStroops: bigint): bigint {
  const native = a.balances.find((b) => b.asset_type === "native");
  if (!native) return 0n;
  return toStroops(native.balance) - minimumBalanceStroops(a, baseReserveStroops) - toStroops(native.selling_liabilities ?? "0");
}

/**
 * Derive a plan's state purely from the owner's account (A§2.7). First match wins.
 * Changed from the original spec: REVOKED no longer requires S < s1, so a revoke after a
 * cancelled claim shows as REVOKED. A failed Phase 2 also looks like this; callers can tell
 * the two apart with plan_events.
 */
export function derivePlanState(
  account: HorizonAccount, plan: PlanOnChainRef, now: number, baseReserveStroops: bigint,
): DerivedState {
  const S = BigInt(account.sequence);
  const T = Number(account.sequence_time ?? "0");
  const s1 = plan.phase1Seq;
  const keys = new Set(account.signers.filter((s) => s.weight > 0).map((s) => s.key));
  const has1 = keys.has(preauthSignerKey(plan.phase1Hash));
  const has2 = keys.has(preauthSignerKey(plan.phase2Hash));
  const heirIsSigner = keys.has(plan.heir);
  const diagnostics: string[] = [];

  // No reserve guard is needed (spike SP4): Phase 1 removes its own pre-auth signer, freeing one
  // reserve before Phase 2 can run, and the owner can't spend it without cancelling the claim.
  const ownerCanPayFee = availableXlmStroops(account, baseReserveStroops) >= OWNER_FEE_MARGIN_STROOPS;

  const out = (state: PlanState, extra: Partial<DerivedState> = {}): DerivedState =>
    ({ state, seq: S, seqTime: T, ownerCanPayFee, diagnostics, ...extra });

  if (heirIsSigner) return out("INHERITED");

  if (!has1 && !has2) {
    if (S < plan.baseSeq) return out("DRAFT");
    if (S === s1) {
      diagnostics.push("Phase 1 executed but the Phase 2 signer is missing.");
      return out("BROKEN");
    }
    return out("REVOKED");
  }

  if (S < s1 && has1 && has2) {
    const eligibleAt = T + plan.inactivitySeconds;
    return out(now >= eligibleAt ? "ELIGIBLE" : "ARMED", { eligibleAt });
  }

  if (S === s1 && has2) {
    const claimableAt = T + plan.graceSeconds;
    return out(now >= claimableAt ? "CLAIMABLE" : "NOTICE", { claimableAt });
  }

  if (S > s1) return out("CANCELLED");

  if (has1 !== has2) diagnostics.push(`Only one of the two Riktha signers is present (phase1: ${has1}, phase2: ${has2}).`);
  if (S >= s1 && has1) diagnostics.push("Phase 1 signer still present after its sequence was reached.");
  return out("BROKEN");
}

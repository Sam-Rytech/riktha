import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { preauthSignerKey } from "@/lib/core/builders";
import { derivePlanState, HorizonAccount, PlanOnChainRef } from "@/lib/core/state";

const owner = Keypair.random().publicKey();
const heir = Keypair.random().publicKey();
const h1 = "11".repeat(32), h2 = "22".repeat(32);
const RESERVE = 5_000_000n;
const plan: PlanOnChainRef = {
  heir, variant: "sponsored", baseSeq: 101n, phase1Seq: 1_000_000_101n,
  phase1Hash: h1, phase2Hash: h2, inactivitySeconds: 100, graceSeconds: 50,
};
const T = 1_000_000;

function acct(seq: bigint, signers: string[], over: Partial<HorizonAccount> = {}): HorizonAccount {
  return {
    account_id: owner,
    sequence: seq.toString(),
    sequence_time: String(T),
    signers: [
      { key: owner, weight: 1, type: "ed25519_public_key" },
      ...signers.map((k) => ({ key: k, weight: 1, type: k.startsWith("T") ? "preauth_tx" : "ed25519_public_key" })),
    ],
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    balances: [{ asset_type: "native", balance: "100.0000000", selling_liabilities: "0.0000000" }],
    subentry_count: signers.length,
    ...over,
  };
}
const P1 = preauthSignerKey(h1), P2 = preauthSignerKey(h2);
const derive = (a: HorizonAccount, now = T, p = plan) => derivePlanState(a, p, now, RESERVE);

describe("derivePlanState", () => {
  it("DRAFT before setup executes", () => {
    expect(derive(acct(100n, [])).state).toBe("DRAFT");
  });
  it("ARMED with eligibleAt = T + I", () => {
    const d = derive(acct(101n, [P1, P2]), T + 99);
    expect(d.state).toBe("ARMED");
    expect(d.eligibleAt).toBe(T + 100);
  });
  it("ARMED stays ARMED after more owner activity (S still < s1)", () => {
    expect(derive(acct(150n, [P1, P2]), T + 10).state).toBe("ARMED");
  });
  it("ELIGIBLE once the window has passed", () => {
    expect(derive(acct(101n, [P1, P2]), T + 100).state).toBe("ELIGIBLE");
  });
  it("NOTICE after Phase 1, with claimableAt = T + G", () => {
    const d = derive(acct(plan.phase1Seq, [P2]), T + 10);
    expect(d.state).toBe("NOTICE");
    expect(d.claimableAt).toBe(T + 50);
  });
  it("CLAIMABLE after grace", () => {
    expect(derive(acct(plan.phase1Seq, [P2]), T + 50).state).toBe("CLAIMABLE");
  });
  it("CANCELLED when the owner acts after Phase 1", () => {
    expect(derive(acct(plan.phase1Seq + 1n, [P2])).state).toBe("CANCELLED");
  });
  it("INHERITED once the heir is a signer", () => {
    expect(derive(acct(plan.phase1Seq + 1n, [heir])).state).toBe("INHERITED");
  });
  it("REVOKED when both signers were removed before Phase 1", () => {
    expect(derive(acct(102n, [])).state).toBe("REVOKED");
  });
  it("REVOKED after a cancelled claim was revoked (fixed rule)", () => {
    expect(derive(acct(plan.phase1Seq + 2n, [])).state).toBe("REVOKED");
  });
  it("BROKEN when only one signer is present before Phase 1", () => {
    const d = derive(acct(101n, [P1]));
    expect(d.state).toBe("BROKEN");
    expect(d.diagnostics.length).toBeGreaterThan(0);
  });
  it("BROKEN when at s1 with no Phase 2 signer", () => {
    expect(derive(acct(plan.phase1Seq, [])).state).toBe("BROKEN");
  });
  it("ignores zero-weight signers", () => {
    const a = acct(101n, [P1, P2]);
    a.signers[2].weight = 0;
    expect(derive(a).state).toBe("BROKEN");
  });
  it("treats a missing sequence_time as 0", () => {
    const a = acct(101n, [P1, P2], { sequence_time: undefined });
    expect(derive(a, 100).state).toBe("ELIGIBLE");
  });
  it("ownerCanPayFee reflects spendable XLM", () => {
    const rich = acct(101n, [P1, P2]);
    const atMin = acct(101n, [P1, P2], { balances: [{ asset_type: "native", balance: "2.0000000" }] }); // 4 reserves = 2 XLM
    expect(derive(rich).ownerCanPayFee).toBe(true);
    expect(derive(atMin).ownerCanPayFee).toBe(false);
  });
});

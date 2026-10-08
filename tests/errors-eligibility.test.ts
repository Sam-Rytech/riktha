import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { buildPlan, preauthSignerKey } from "@/lib/core/builders";
import { checkHeirAccount, checkOwnerAccount, checkWindows, formatXlm } from "@/lib/core/eligibility";
import { extractResultCodes, mapSubmitError } from "@/lib/core/errors";
import { explainTx } from "@/lib/core/explain";
import { HorizonAccount } from "@/lib/core/state";

describe("mapSubmitError", () => {
  it("maps fee-bumped minSeqAge failures (codes observed in spike SP5)", () => {
    expect(mapSubmitError({ transaction: "tx_fee_bump_inner_failed", inner_transaction: "tx_bad_minseq_age_or_gap" }).kind).toBe("NOT_YET");
  });
  it("maps inner-only minSeqAge failures", () => {
    expect(mapSubmitError({ transaction: "tx_bad_minseq_age_or_gap" }).kind).toBe("NOT_YET");
  });
  it("maps bad_seq to CANCELLED", () => {
    expect(mapSubmitError({ transaction: "tx_fee_bump_inner_failed", inner_transaction: "tx_bad_seq" }).kind).toBe("CANCELLED");
  });
  it("maps op_no_trust", () => {
    expect(mapSubmitError({ transaction: "tx_failed", operations: ["op_no_trust"] }).kind).toBe("NO_TRUST");
  });
  it("falls back to UNKNOWN with the codes", () => {
    const m = mapSubmitError({ transaction: "tx_weird" });
    expect(m.kind).toBe("UNKNOWN");
    expect(m.message).toMatch(/tx_weird/);
  });
  it("extracts codes from an SDK error", () => {
    expect(extractResultCodes({ response: { data: { extras: { result_codes: { transaction: "tx_bad_seq" } } } } })).toEqual({ transaction: "tx_bad_seq" });
    expect(extractResultCodes(new Error("x"))).toEqual({});
  });
});

const owner = Keypair.random().publicKey();
const RESERVE = 5_000_000n;
const acct = (signers: HorizonAccount["signers"] = [], balance = "100.0000000", over: Partial<HorizonAccount> = {}): HorizonAccount => ({
  account_id: owner, sequence: "1",
  signers: [{ key: owner, weight: 1, type: "ed25519_public_key" }, ...signers],
  thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
  balances: [{ asset_type: "native", balance }],
  subentry_count: signers.length, ...over,
});

describe("checkOwnerAccount", () => {
  it("accepts a plain funded account", () => {
    expect(checkOwnerAccount(acct(), RESERVE)).toMatchObject({ ok: true, weight: 1, stalePreauthHashes: [] });
  });
  it("rejects a missing account", () => {
    expect(checkOwnerAccount(null, RESERVE).ok).toBe(false);
  });
  it("rejects multisig", () => {
    const r = checkOwnerAccount(acct([{ key: Keypair.random().publicKey(), weight: 1, type: "ed25519_public_key" }]), RESERVE);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/multisig/);
  });
  it("collects known stale Riktha signers (re-arm)", () => {
    const h = "ab".repeat(32);
    const r = checkOwnerAccount(acct([{ key: preauthSignerKey(h), weight: 1, type: "preauth_tx" }]), RESERVE, [h]);
    expect(r.ok).toBe(true);
    expect(r.stalePreauthHashes).toEqual([h]);
  });
  it("rejects unknown pre-auth signers", () => {
    expect(checkOwnerAccount(acct([{ key: preauthSignerKey("cd".repeat(32)), weight: 1, type: "preauth_tx" }]), RESERVE).ok).toBe(false);
  });
  it("rejects too little XLM (needs 2 reserves + 1 XLM spare)", () => {
    expect(checkOwnerAccount(acct([], "2.9999999"), RESERVE).ok).toBe(false); // min 1 + need 2
    expect(checkOwnerAccount(acct([], "3.0000000"), RESERVE).ok).toBe(true);
  });
  it("rejects custom thresholds above master weight", () => {
    expect(checkOwnerAccount(acct([], "100", { thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 2 } }), RESERVE).ok).toBe(false);
  });
});

describe("checkHeirAccount / checkWindows / format", () => {
  it("validates the heir", () => {
    expect(checkHeirAccount("nope", owner, null)[0]).toMatch(/valid/);
    expect(checkHeirAccount(owner, owner, acct())[0]).toMatch(/different/);
    expect(checkHeirAccount(Keypair.random().publicKey(), owner, null)[0]).toMatch(/exist/);
    expect(checkHeirAccount(Keypair.random().publicKey(), owner, acct())).toEqual([]);
  });
  it("enforces minimum windows per network", () => {
    expect(checkWindows("testnet", 60, 60)).toEqual([]);
    expect(checkWindows("testnet", 59, 60)).toHaveLength(1);
    expect(checkWindows("mainnet", 120, 120)).toHaveLength(2);
  });
  it("formats XLM", () => {
    expect(formatXlm(20_000_000n)).toBe("2");
    expect(formatXlm(25_000_000n)).toBe("2.5");
    expect(formatXlm(100_000_000n)).toBe("10");
    expect(formatXlm(1n)).toBe("0.0000001");
  });
});

describe("explainTx", () => {
  it("describes the plan transactions in plain language", () => {
    const heir = Keypair.random().publicKey();
    const p = buildPlan({ network: "testnet", owner, heir, inactivitySeconds: 180 * 86400, graceSeconds: 30 * 86400, variant: "sponsored", weight: 1, currentSeq: 1n, stalePreauthHashes: [] });
    const names = { [owner]: "your account", [heir]: "your heir" };
    const e1 = explainTx(p.phase1, names);
    expect(e1.conditions.join(" ")).toMatch(/180 days/);
    expect(e1.ops[0].plain).toMatch(/Record activity/);
    const e2 = explainTx(p.phase2, names);
    expect(e2.ops[1].plain).toBe("Give your heir full control of your account.");
    expect(explainTx(p.setup, names).ops.every((o) => /Pre-approve/.test(o.plain))).toBe(true);
  });
});

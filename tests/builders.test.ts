import { Asset, Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  buildCheckIn, buildEstateTransfer, buildInheritedPayment, buildPlan, buildRevoke, memoText, parseTx, PlanParams, preauthSignerKey, txHashHex, wrapFeeBump,
} from "@/lib/core/builders";
import { MEMOS, SEQ_JUMP } from "@/lib/core/config";

const owner = Keypair.random().publicKey();
const heir = Keypair.random().publicKey();
const params = (over: Partial<PlanParams> = {}): PlanParams => ({
  network: "testnet", owner, heir, inactivitySeconds: 120, graceSeconds: 60,
  variant: "sponsored", weight: 1, currentSeq: 1000n, stalePreauthHashes: [], ...over,
});

describe("buildPlan", () => {
  it("computes X, s1, s2", () => {
    const p = buildPlan(params());
    expect(p.baseSeq).toBe(1001n);
    expect(p.phase1Seq).toBe(1001n + SEQ_JUMP);
    expect(p.phase2Seq).toBe(1002n + SEQ_JUMP);
    expect(p.setup.sequence).toBe("1001");
    expect(p.phase1.sequence).toBe(p.phase1Seq.toString());
    expect(p.phase2.sequence).toBe(p.phase2Seq.toString());
  });

  it("sets Phase 1 preconditions, op and memo exactly", () => {
    const { phase1 } = buildPlan(params());
    expect(phase1.source).toBe(owner);
    expect(phase1.minAccountSequence).toBe("1001");
    expect(phase1.minAccountSequenceAge).toBe(120n);
    expect(phase1.timeBounds?.maxTime ?? "0").toBe("0");
    expect(memoText(phase1)).toBe(MEMOS.notice);
    expect(phase1.operations).toHaveLength(1);
    expect(phase1.operations[0].type).toBe("bumpSequence");
    expect(phase1.signatures).toHaveLength(0);
  });

  it("builds the sponsored Phase 2 with the right op sources", () => {
    const { phase2 } = buildPlan(params());
    expect(phase2.minAccountSequence).toBeUndefined();
    expect(phase2.minAccountSequenceAge).toBe(60n);
    expect(memoText(phase2)).toBe(MEMOS.handover);
    const [begin, set, end] = phase2.operations;
    expect(begin.type).toBe("beginSponsoringFutureReserves");
    expect(begin.source).toBe(heir);
    expect(set.type).toBe("setOptions");
    expect(set.source).toBeUndefined();
    expect(end.type).toBe("endSponsoringFutureReserves");
    expect(end.source).toBe(owner);
    expect((set as { signer: { ed25519PublicKey: string; weight: number } }).signer).toMatchObject({ ed25519PublicKey: heir, weight: 1 });
  });

  it("builds the plain Phase 2 as a single setOptions", () => {
    const { phase2 } = buildPlan(params({ variant: "plain", weight: 3 }));
    expect(phase2.operations.map((o) => o.type)).toEqual(["setOptions"]);
    expect((phase2.operations[0] as { signer: { weight: number } }).signer.weight).toBe(3);
  });

  it("setup adds both pre-auth signers with weight W", () => {
    const p = buildPlan(params({ weight: 2 }));
    const signers = p.setup.operations.map((o) => (o as unknown as { signer: { preAuthTx: Uint8Array; weight: number } }).signer);
    expect(signers.map((s) => Buffer.from(s.preAuthTx).toString("hex"))).toEqual([p.phase1Hash, p.phase2Hash]);
    expect(signers.every((s) => s.weight === 2)).toBe(true);
    expect(p.setup.timeBounds?.maxTime).not.toBe("0");
  });

  it("setup removes stale hashes first", () => {
    const stale = ["aa".repeat(32), "bb".repeat(32)];
    const p = buildPlan(params({ stalePreauthHashes: stale }));
    const signers = p.setup.operations.map((o) => (o as unknown as { signer: { preAuthTx: Uint8Array; weight: number } }).signer);
    expect(signers).toHaveLength(4);
    expect(signers.slice(0, 2).map((s) => [Buffer.from(s.preAuthTx).toString("hex"), s.weight])).toEqual([[stale[0], 0], [stale[1], 0]]);
  });

  it("hashes are stable for identical inputs and change with the heir", () => {
    const a = buildPlan(params()), b = buildPlan(params());
    expect(a.phase1Hash).toBe(b.phase1Hash);
    expect(a.phase2Hash).toBe(b.phase2Hash);
    expect(buildPlan(params({ heir: Keypair.random().publicKey() })).phase2Hash).not.toBe(a.phase2Hash);
  });

  it("XDR round-trips to the same hash", () => {
    const p = buildPlan(params());
    expect(txHashHex(parseTx("testnet", p.phase1.toXDR()))).toBe(p.phase1Hash);
    expect(txHashHex(parseTx("testnet", p.phase2.toXDR()))).toBe(p.phase2Hash);
  });

  it("rejects heir == owner", () => {
    expect(() => buildPlan(params({ heir: owner }))).toThrow();
  });

  it("preauthSignerKey gives a T… StrKey", () => {
    expect(preauthSignerKey(buildPlan(params()).phase1Hash)).toMatch(/^T[A-Z2-7]{55}$/);
  });
});

describe("other builders", () => {
  it("buildRevoke removes every hash", () => {
    const tx = buildRevoke("testnet", owner, 5n, ["aa".repeat(32), "bb".repeat(32)]);
    expect(tx.sequence).toBe("6");
    expect(tx.operations.map((o) => (o as { signer: { weight: number } }).signer.weight)).toEqual([0, 0]);
  });

  it("buildCheckIn is a memo'd bumpSequence", () => {
    const tx = buildCheckIn("testnet", owner, 5n);
    expect(tx.operations[0].type).toBe("bumpSequence");
    expect(memoText(tx)).toBe(MEMOS.alive);
  });

  it("buildEstateTransfer: heir is tx source, owner is op source", () => {
    const tx = buildEstateTransfer("testnet", heir, 9n, owner, Asset.native(), "10", heir);
    expect(tx.source).toBe(heir);
    expect(tx.sequence).toBe("10");
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]).toMatchObject({ type: "payment", source: owner, destination: heir, amount: "10.0000000" });
  });

  it("buildEstateTransfer adds a trustline for non-native assets when asked", () => {
    const usdc = new Asset("USDC", Keypair.random().publicKey());
    const tx = buildEstateTransfer("testnet", heir, 9n, owner, usdc, "5", heir, { addTrustline: true });
    expect(tx.operations.map((o) => [o.type, o.source])).toEqual([["changeTrust", heir], ["payment", owner]]);
    const nat = buildEstateTransfer("testnet", heir, 9n, owner, Asset.native(), "5", heir, { addTrustline: true });
    expect(nat.operations).toHaveLength(1);
  });

  it("wrapFeeBump keeps the inner tx intact", () => {
    const p = buildPlan(params());
    const fb = wrapFeeBump("testnet", heir, p.phase2);
    expect(fb.feeSource).toBe(heir);
    expect(txHashHex(fb.innerTransaction)).toBe(p.phase2Hash);
  });

  it("buildInheritedPayment: owner is the source; memo id vs text; create account", () => {
    const dest = Keypair.random().publicKey();
    const pay = buildInheritedPayment("testnet", owner, 41n, dest, Asset.native(), "5", { memo: "123456789" });
    expect(pay.source).toBe(owner);
    expect(pay.sequence).toBe("42");
    expect(pay.memo.type).toBe("id");
    expect(pay.operations[0]).toMatchObject({ type: "payment", destination: dest, amount: "5.0000000" });
    expect(pay.operations[0].source).toBeUndefined();
    expect(memoText(buildInheritedPayment("testnet", owner, 41n, dest, Asset.native(), "5", { memo: "exchange-ref" }))).toBe("exchange-ref");
    expect(buildInheritedPayment("testnet", owner, 41n, dest, Asset.native(), "2", { createDestination: true }).operations[0].type).toBe("createAccount");
    expect(() => buildInheritedPayment("testnet", owner, 41n, dest, new Asset("USDC", Keypair.random().publicKey()), "2", { createDestination: true })).toThrow();
  });
});

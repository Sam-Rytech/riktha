import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { buildPlan, buildPhase2 } from "@/lib/core/builders";
import { makePacket, parsePacket, verifyPacket } from "@/lib/core/packet";

const owner = Keypair.random().publicKey();
const heir = Keypair.random().publicKey();

function packet(variant: "sponsored" | "plain" = "sponsored") {
  const p = buildPlan({ network: "testnet", owner, heir, inactivitySeconds: 120, graceSeconds: 60, variant, weight: 1, currentSeq: 77n, stalePreauthHashes: [] });
  return makePacket({
    network: "testnet", owner, heir, variant, inactivitySeconds: 120, graceSeconds: 60,
    plan: { ...p, phase1Xdr: p.phase1.toXDR(), phase2Xdr: p.phase2.toXDR() },
  });
}

describe("packet", () => {
  it("round-trips through JSON and verifies", () => {
    for (const v of ["sponsored", "plain"] as const) {
      const parsed = parsePacket(JSON.stringify(packet(v)));
      expect(verifyPacket(parsed)).toEqual([]);
    }
  });

  it("rejects a tampered XDR", () => {
    const pk = packet();
    // Same shape, different heir: valid XDR whose hash no longer matches.
    pk.phase2.xdr = buildPhase2("testnet", owner, Keypair.random().publicKey(), BigInt(pk.phase1.seq), 60, "sponsored", 1).toXDR();
    expect(verifyPacket(pk).join(" ")).toMatch(/hash mismatch/);
  });

  it("rejects a changed hash", () => {
    const pk = packet();
    pk.phase1.hash = "00".repeat(32);
    expect(verifyPacket(pk).join(" ")).toMatch(/phase1: hash mismatch/);
  });

  it("rejects the wrong network", () => {
    const pk = { ...packet(), network: "mainnet" as const };
    const errs = verifyPacket(pk).join(" ");
    expect(errs).toMatch(/passphrase/);
    expect(errs).toMatch(/hash mismatch/);
  });

  it("rejects a mismatched window", () => {
    const pk = { ...packet(), inactivitySeconds: 999 };
    expect(verifyPacket(pk).join(" ")).toMatch(/inactivity window/);
  });

  it("rejects malformed JSON shape", () => {
    expect(() => parsePacket({ riktha: "packet/v2" })).toThrow();
  });
});

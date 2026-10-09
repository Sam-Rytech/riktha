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

describe("packet with a claim kit", () => {
  it("carries the kit and rejects one for a different heir", async () => {
    const { createKit } = await import("@/lib/core/claimkit");
    const heirKp = Keypair.random();
    const p = buildPlan({ network: "testnet", owner, heir: heirKp.publicKey(), inactivitySeconds: 120, graceSeconds: 60, variant: "plain", weight: 1, currentSeq: 9n, stalePreauthHashes: [] });
    const kit = { ...(await createKit(heirKp.secret(), owner, "a b c d e f", 1000)), iterations: 600_000 };
    const pk = makePacket({ network: "testnet", owner, heir: heirKp.publicKey(), variant: "plain", inactivitySeconds: 120, graceSeconds: 60, claimKit: kit, plan: { ...p, phase1Xdr: p.phase1.toXDR(), phase2Xdr: p.phase2.toXDR() } });
    const parsed = parsePacket(JSON.stringify(pk));
    expect(parsed.claimKit?.heirPublic).toBe(heirKp.publicKey());
    expect(verifyPacket(parsed)).toEqual([]);
    expect(verifyPacket({ ...parsed, claimKit: { ...kit, heirPublic: Keypair.random().publicKey() } }).join(" ")).toMatch(/different heir/);
  });
});

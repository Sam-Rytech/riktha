import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import { BuiltPlan, memoText, parseTx, txHashHex, Variant } from "./builders";
import { MEMOS, NETWORKS, NetworkName, SEQ_JUMP } from "./config";

const gAddress = z.string().refine((s) => StrKey.isValidEd25519PublicKey(s), "invalid Stellar address");
const seqStr = z.string().regex(/^\d+$/);
const hex32 = z.string().regex(/^[0-9a-f]{64}$/);
const phase = z.object({ seq: seqStr, hash: hex32, xdr: z.string().min(1) });

export const packetSchema = z.object({
  riktha: z.literal("packet/v1"),
  network: z.enum(["testnet", "mainnet"]),
  networkPassphrase: z.string(),
  owner: gAddress,
  heir: gAddress,
  variant: z.enum(["sponsored", "plain"]),
  inactivitySeconds: z.number().int().positive(),
  graceSeconds: z.number().int().positive(),
  baseSequence: seqStr,
  phase1: phase,
  phase2: phase,
  createdAt: z.string(),
  howToClaimWithoutRiktha: z.array(z.string()),
});
export type Packet = z.infer<typeof packetSchema>;

export interface PacketInput {
  network: NetworkName;
  owner: string;
  heir: string;
  variant: Variant;
  inactivitySeconds: number;
  graceSeconds: number;
  plan: Pick<BuiltPlan, "baseSeq" | "phase1Seq" | "phase2Seq" | "phase1Hash" | "phase2Hash"> & { phase1Xdr: string; phase2Xdr: string };
  createdAt?: Date;
}

export function makePacket(i: PacketInput): Packet {
  const signStep = i.variant === "sponsored" ? "Sign phase2.xdr with your key, then wrap it" : "Wrap phase2.xdr (no signature needed)";
  return {
    riktha: "packet/v1",
    network: i.network,
    networkPassphrase: NETWORKS[i.network].passphrase,
    owner: i.owner,
    heir: i.heir,
    variant: i.variant,
    inactivitySeconds: i.inactivitySeconds,
    graceSeconds: i.graceSeconds,
    baseSequence: i.plan.baseSeq.toString(),
    phase1: { seq: i.plan.phase1Seq.toString(), hash: i.plan.phase1Hash, xdr: i.plan.phase1Xdr },
    phase2: { seq: i.plan.phase2Seq.toString(), hash: i.plan.phase2Hash, xdr: i.plan.phase2Xdr },
    createdAt: (i.createdAt ?? new Date()).toISOString(),
    howToClaimWithoutRiktha: [
      "1. Wait until the owner has sent nothing for the inactivity window.",
      "2. In Stellar Lab, submit phase1.xdr as is (the owner's account pays a tiny fee), or wrap it in a fee-bump paid by your account.",
      `3. Wait the grace window. ${signStep} in a fee-bump paid by your account, and submit.`,
      "4. You are now a signer on the owner's account and can move its assets.",
    ],
  };
}

export function parsePacket(json: unknown): Packet {
  return packetSchema.parse(typeof json === "string" ? JSON.parse(json) : json);
}

/** Recompute everything from the XDRs; returns a list of problems (empty = valid). */
export function verifyPacket(p: Packet): string[] {
  const errors: string[] = [];
  if (NETWORKS[p.network].passphrase !== p.networkPassphrase) errors.push("network passphrase does not match the network");
  const base = BigInt(p.baseSequence), s1 = BigInt(p.phase1.seq), s2 = BigInt(p.phase2.seq);
  if (s1 !== base + SEQ_JUMP) errors.push("phase1 sequence is not baseSequence + SEQ_JUMP");
  if (s2 !== s1 + 1n) errors.push("phase2 sequence is not phase1 + 1");

  const check = (label: "phase1" | "phase2", memo: string) => {
    let tx;
    try {
      tx = parseTx(p.network, p[label].xdr);
    } catch (e) {
      errors.push(`${label}: cannot parse XDR (${(e as Error).message})`);
      return undefined;
    }
    if (txHashHex(tx) !== p[label].hash) errors.push(`${label}: hash mismatch (tampered or wrong network)`);
    if (tx.source !== p.owner) errors.push(`${label}: source is not the owner`);
    if (tx.sequence !== p[label].seq) errors.push(`${label}: sequence mismatch`);
    if (memoText(tx) !== memo) errors.push(`${label}: unexpected memo`);
    if (tx.timeBounds && tx.timeBounds.maxTime !== "0") errors.push(`${label}: must not expire`);
    return tx;
  };

  const t1 = check("phase1", MEMOS.notice);
  if (t1) {
    if (t1.minAccountSequence !== p.baseSequence) errors.push("phase1: minSeqNum must equal baseSequence");
    if (t1.minAccountSequenceAge !== BigInt(p.inactivitySeconds)) errors.push("phase1: minSeqAge must equal the inactivity window");
    if (t1.operations.length !== 1 || t1.operations[0].type !== "bumpSequence") errors.push("phase1: must be a single bumpSequence");
  }

  const t2 = check("phase2", MEMOS.handover);
  if (t2) {
    if (t2.minAccountSequence !== undefined) errors.push("phase2: must not set minSeqNum");
    if (t2.minAccountSequenceAge !== BigInt(p.graceSeconds)) errors.push("phase2: minSeqAge must equal the grace window");
    const types = t2.operations.map((o) => o.type).join(",");
    const want = p.variant === "sponsored"
      ? "beginSponsoringFutureReserves,setOptions,endSponsoringFutureReserves"
      : "setOptions";
    if (types !== want) errors.push(`phase2: operations must be ${want}`);
    const set = t2.operations.find((o) => o.type === "setOptions") as { signer?: { ed25519PublicKey?: string; weight?: number } } | undefined;
    if (set?.signer?.ed25519PublicKey !== p.heir || !set.signer.weight) errors.push("phase2: must add the heir as a signer");
  }
  return errors;
}

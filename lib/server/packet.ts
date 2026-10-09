import "server-only";
import type { Variant } from "@/lib/core/builders";
import type { NetworkName } from "@/lib/core/config";
import { makePacket, type Packet } from "@/lib/core/packet";
import type { Plan } from "./db/schema";

export function packetFromRow(plan: Plan): Packet {
  return makePacket({
    network: plan.network as NetworkName, owner: plan.ownerAddress, heir: plan.heirAddress, variant: plan.variant as Variant,
    inactivitySeconds: plan.inactivitySecs, graceSeconds: plan.graceSecs, createdAt: plan.createdAt, claimKit: plan.heirKit,
    plan: {
      baseSeq: BigInt(plan.baseSeq), phase1Seq: BigInt(plan.phase1Seq), phase2Seq: BigInt(plan.phase2Seq),
      phase1Hash: plan.phase1Hash, phase2Hash: plan.phase2Hash, phase1Xdr: plan.phase1Xdr, phase2Xdr: plan.phase2Xdr,
    },
  });
}

export const packetFilename = (plan: Plan) => `riktha-packet-${plan.ownerAddress.slice(0, 6)}-v${plan.version}.json`;

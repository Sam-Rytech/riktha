"use client";

// Claim-kit heir landing page, linked from every heir email (A§15). No sign-in.
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import KitClaim from "./KitClaim";
import { ErrorBox } from "./ui";
import { NETWORK } from "@/lib/client/actions";
import { type Packet, parsePacket, verifyPacket } from "@/lib/core/packet";

type KitPacket = Packet & { claimKit: NonNullable<Packet["claimKit"]> };

export default function InheritClient() {
  const { id } = useParams<{ id: string }>();
  const [packet, setPacket] = useState<KitPacket>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/inherit/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("This inheritance link isn't valid. Check the link in your email, or upload the packet file at Claim with packet.");
      const p = parsePacket((await res.json()).packet);
      const problems = verifyPacket(p);
      if (problems.length || !p.claimKit || p.network !== NETWORK) throw new Error("This plan's data failed verification. Don't use it, and contact the owner's family.");
      setPacket(p as KitPacket);
    })().catch((e) => setError(e.message));
  }, [id]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-[var(--inset)] pb-6 pt-8 sm:pt-12">
      {packet ? <KitClaim packet={packet} /> : error ? <ErrorBox message={error} /> : <p className="text-muted">Loading…</p>}
    </main>
  );
}

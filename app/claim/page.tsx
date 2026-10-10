"use client";

// Packet-only claim (PRD H6): no sign-in, no Riktha API, no database. Everything is derived from the chain.
import { useCallback, useEffect, useState } from "react";
import ClaimActions from "@/components/ClaimActions";
import KitClaim from "@/components/KitClaim";
import { btn, Card, ErrorBox, short, StateBadge } from "@/components/ui";
import { NETWORK } from "@/lib/client/actions";
import { formatDuration } from "@/lib/core/eligibility";
import { type Packet, parsePacket, verifyPacket } from "@/lib/core/packet";
import { derivePlanState, type DerivedState } from "@/lib/core/state";
import { baseReserveStroops, loadAccountRaw } from "@/lib/stellar/horizon";

export default function ClaimPage() {
  const [packet, setPacket] = useState<Packet>();
  const [pasted, setPasted] = useState("");
  const [derived, setDerived] = useState<DerivedState>();
  const [error, setError] = useState<{ message: string; details?: string[] }>();

  function accept(text: string) {
    setError(undefined);
    setDerived(undefined);
    try {
      const p = parsePacket(text);
      const problems = verifyPacket(p);
      if (problems.length) return setError({ message: "This packet failed verification. Don't use it.", details: problems });
      if (p.network !== NETWORK) return setError({ message: `This packet is for ${p.network}, but this site runs on ${NETWORK}.` });
      setPacket(p);
    } catch {
      setError({ message: "That doesn't look like a Riktha inheritance packet (a .json file starting with \"riktha\": \"packet/v1\")." });
    }
  }

  const refresh = useCallback(async () => {
    if (!packet) return;
    const [account, reserve] = await Promise.all([loadAccountRaw(NETWORK, packet.owner), baseReserveStroops(NETWORK)]);
    if (!account) return setError({ message: "The owner's account no longer exists on the network." });
    setDerived(derivePlanState(account, {
      heir: packet.heir, variant: packet.variant, baseSeq: BigInt(packet.baseSequence), phase1Seq: BigInt(packet.phase1.seq),
      phase1Hash: packet.phase1.hash, phase2Hash: packet.phase2.hash,
      inactivitySeconds: packet.inactivitySeconds, graceSeconds: packet.graceSeconds,
    }, Math.floor(Date.now() / 1000), reserve));
  }, [packet]);

  useEffect(() => {
    if (!packet) return;
    refresh().catch((e) => setError({ message: e.message }));
    const t = setInterval(() => refresh().catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, [packet, refresh]);

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-5 px-6 pb-6 pt-8 sm:px-10 sm:pt-12 *:max-w-3xl">
      <div>
        <h1 className="headline text-[30px] sm:text-[40px]">Claim with an inheritance packet</h1>
        <p className="mt-2 text-muted">
          This page needs nothing from Riktha&apos;s servers: it checks the packet in your browser, reads the owner&apos;s account
          straight from the Stellar network, and submits the pre-approved transactions there. No sign-in.
        </p>
      </div>

      {!packet && (
        <Card>
          <label className="block">
            <span className="text-sm font-medium">Choose the packet file</span>
            <input type="file" accept="application/json,.json" className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-green file:px-4 file:py-2 file:text-white"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) accept(await f.text()); }} />
          </label>
          <p className="my-4 text-center text-xs uppercase tracking-widest text-muted">or</p>
          <label className="block">
            <span className="text-sm font-medium">Paste its contents</span>
            <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} spellCheck={false}
              className="mt-1 w-full rounded-[var(--radius-field)] border border-line bg-paper p-3 font-mono text-xs outline-none focus:border-accent" placeholder='{ "riktha": "packet/v1", … }' />
          </label>
          <button onClick={() => accept(pasted)} disabled={!pasted.trim()} className={btn.primary + " mt-3"}>Check packet</button>
        </Card>
      )}

      <ErrorBox message={error?.message} details={error?.details} />

      {packet?.claimKit && <KitClaim packet={{ ...packet, claimKit: packet.claimKit }} />}

      {packet && !packet.claimKit && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">✓ Packet verified: hashes, sequences and conditions all match.</p>
                <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.01em]">Owner <span className="font-mono text-base" title={packet.owner}>{short(packet.owner)}</span> → heir <span className="font-mono text-base" title={packet.heir}>{short(packet.heir)}</span></h2>
                <p className="text-sm text-muted">Waits {formatDuration(packet.inactivitySeconds)}, then {formatDuration(packet.graceSeconds)} for the owner to respond</p>
              </div>
              {derived && <StateBadge state={derived.state} />}
            </div>
            <button onClick={() => { setPacket(undefined); setDerived(undefined); setPasted(""); }} className={btn.link + " mt-3"}>Use a different packet</button>
          </Card>
          {derived ? (
            <ClaimActions
              info={{ state: derived.state, owner: packet.owner, heir: packet.heir, variant: packet.variant, phase1Xdr: packet.phase1.xdr, phase2Xdr: packet.phase2.xdr, eligibleAt: derived.eligibleAt, claimableAt: derived.claimableAt, ownerCanPayFee: derived.ownerCanPayFee }}
              onChanged={() => refresh().catch(() => {})}
            />
          ) : <p className="text-muted">Reading the owner&apos;s account…</p>}
        </>
      )}
    </main>
  );
}

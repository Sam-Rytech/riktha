"use client";

import type { Keypair } from "@stellar/stellar-sdk";
import { useCallback, useEffect, useState } from "react";
import { NETWORK, submitPhase } from "@/lib/client/actions";
import { isValidCode, openKit } from "@/lib/core/claimkit";
import { formatDuration } from "@/lib/core/eligibility";
import type { Packet } from "@/lib/core/packet";
import { derivePlanState, type DerivedState } from "@/lib/core/state";
import { baseReserveStroops, explorerTxUrl, loadAccountRaw } from "@/lib/stellar/horizon";
import InheritedWallet from "./InheritedWallet";
import { btn, Card, Countdown, ErrorBox, NightPanel, short, StateBadge, Status } from "./ui";

/** The heir's whole journey with a claim kit: no wallet, no account, no sign-in (A§15). */
export default function KitClaim({ packet }: { packet: Packet & { claimKit: NonNullable<Packet["claimKit"]> } }) {
  const [code, setCode] = useState("");
  const [heir, setHeir] = useState<Keypair>();
  const [st, setSt] = useState<DerivedState>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<string>();

  const refresh = useCallback(async () => {
    const [account, reserve] = await Promise.all([loadAccountRaw(NETWORK, packet.owner), baseReserveStroops(NETWORK)]);
    if (!account) return setError("The owner's account no longer exists on the network.");
    setSt(derivePlanState(account, {
      heir: packet.heir, variant: packet.variant, baseSeq: BigInt(packet.baseSequence), phase1Seq: BigInt(packet.phase1.seq),
      phase1Hash: packet.phase1.hash, phase2Hash: packet.phase2.hash, inactivitySeconds: packet.inactivitySeconds, graceSeconds: packet.graceSeconds,
    }, Math.floor(Date.now() / 1000), reserve));
  }, [packet]);

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const t = setInterval(() => refresh().catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function unlock() {
    setError(undefined); setBusy("Checking your code…");
    try { setHeir(await openKit(packet.claimKit, packet.owner, code)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(undefined); }
  }

  async function phase(n: 1 | 2) {
    setError(undefined); setBusy("Sending to the Stellar network…");
    try {
      setHash(await submitPhase(n === 1 ? packet.phase1.xdr : packet.phase2.xdr));
      setTimeout(() => refresh().catch(() => {}), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(undefined); }
  }

  return (
    <div className="space-y-5">
      <NightPanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[14px] text-white/55">From Stellar account <span className="font-mono" title={packet.owner}>{short(packet.owner)}</span></p>
          {st && <StateBadge state={st.state} onNight />}
        </div>
        <h1 className="headline mt-4 text-[34px] sm:text-[52px]">An inheritance for you</h1>
        <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-white/65">
          The owner chose a {formatDuration(packet.inactivitySeconds)} waiting period, then {formatDuration(packet.graceSeconds)} for them to respond.
          You don&apos;t need a wallet or any crypto to claim.
        </p>
      </NightPanel>

      {!heir ? (
        <Card>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Enter your claim code</h2>
          <p className="mt-1 text-muted">Six words the owner gave you, for example in their will or a sealed letter. The code never leaves this device.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (isValidCode(code)) unlock(); }} className="mt-4 space-y-3">
            <label className="block">
              <span className="sr-only">Claim code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}
                placeholder="six words separated by spaces" className="w-full rounded-[var(--radius-field)] border border-line bg-surface px-4 py-4 font-mono text-[17px] outline-none focus:border-green" />
            </label>
            {code.trim() !== "" && !isValidCode(code) && <p className="text-sm text-muted">Keep typing: the code is exactly six words.</p>}
            <button type="submit" disabled={!isValidCode(code) || !!busy} className={btn.primary}>Unlock</button>
          </form>
        </Card>
      ) : (
        <>
          <p className="text-sm text-green">✓ Code accepted. Keep it safe: you&apos;ll need it again if you come back to this page.</p>
          {st?.state === "ARMED" && (
            <Card><Countdown to={st.eligibleAt} label="The owner is still active. If they stop using their account, a claim can start in" />
              <p className="mt-3 text-sm text-muted">We&apos;ll email you when there&apos;s something to do. Nothing is needed now.</p></Card>
          )}
          {st?.state === "ELIGIBLE" && (
            <Card tone="accent">
              <h2 className="text-[19px] font-semibold tracking-[-0.01em]">The owner&apos;s waiting period has passed</h2>
              <p className="mt-1 text-muted">Starting the claim notifies the owner and gives them {formatDuration(packet.graceSeconds)} to respond. Riktha usually does this for you within minutes.</p>
              {st.ownerCanPayFee && <button onClick={() => phase(1)} disabled={!!busy} className={btn.primary + " mt-4"}>Start the claim</button>}
            </Card>
          )}
          {st?.state === "NOTICE" && <Card><Countdown to={st.claimableAt} label="Claim started. Unless the owner responds, you can claim the inheritance in" /></Card>}
          {st?.state === "CLAIMABLE" && (
            <Card tone="accent">
              <h2 className="text-[19px] font-semibold tracking-[-0.01em]">You can claim the inheritance now</h2>
              <p className="mt-1 text-muted">This gives your claim key control of the account. It takes a few seconds.</p>
              <button onClick={() => phase(2)} disabled={!!busy || !st.ownerCanPayFee} className={btn.primary + " mt-4"}>Claim the inheritance</button>
            </Card>
          )}
          {st?.state === "INHERITED" && <InheritedWallet heir={heir} owner={packet.owner} />}
          {st?.state === "CANCELLED" && <Card><p>The owner used their account, so this claim was cancelled. If they set up their plan again, your claim code keeps working.</p></Card>}
          {st?.state === "REVOKED" && <Card><p>The owner cancelled their inheritance plan.</p></Card>}
          {st?.state === "BROKEN" && <Card><p>The owner&apos;s account no longer matches this plan.</p></Card>}
        </>
      )}

      <Status text={busy} />
      {hash && !busy && <p className="text-sm">✓ Sent. <a className={btn.link} href={explorerTxUrl(NETWORK, hash)} target="_blank" rel="noreferrer">View the transaction</a></p>}
      <ErrorBox message={error} />
    </div>
  );
}

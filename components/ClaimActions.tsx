"use client";

import { useState } from "react";
import { NETWORK, submitPhase } from "@/lib/client/actions";
import { explorerTxUrl } from "@/lib/stellar/horizon";
import { connect } from "@/lib/wallet/freighter";
import EstatePanel from "./EstatePanel";
import { btn, Card, Countdown, ErrorBox, Status } from "./ui";

export interface ClaimInfo {
  state: string; owner: string; heir: string; variant: "plain" | "sponsored";
  phase1Xdr: string; phase2Xdr: string; eligibleAt?: number; claimableAt?: number; ownerCanPayFee?: boolean;
}

/** What the heir (or anyone holding the packet) can do in each state. Works without Riktha's API. */
export default function ClaimActions({ info, onChanged }: { info: ClaimInfo; onChanged: () => void }) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<string>();

  async function run(phase: 1 | 2, payWithWallet: boolean) {
    setError(undefined);
    setBusy(payWithWallet ? "Approve the fee in Freighter…" : "Sending to the Stellar network…");
    try {
      const needsHeirSig = phase === 2 && info.variant === "sponsored";
      const wallet = payWithWallet || needsHeirSig ? await connect() : undefined;
      if (needsHeirSig && wallet !== info.heir) throw new Error("This handover must be signed by the heir's account. Switch Freighter to it.");
      const h = await submitPhase(phase === 1 ? info.phase1Xdr : info.phase2Xdr, {
        feeSource: payWithWallet ? wallet : undefined,
        innerSigner: needsHeirSig ? wallet : undefined,
        availableFrom: phase === 1 && info.eligibleAt ? new Date(info.eligibleAt * 1000) : info.claimableAt ? new Date(info.claimableAt * 1000) : undefined,
      });
      setHash(h);
      setTimeout(onChanged, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  const buttons = (phase: 1 | 2, label: string) => (
    <div className="mt-4 flex flex-wrap gap-3">
      <button onClick={() => run(phase, true)} disabled={!!busy} className={btn.primary}>{label}</button>
      {info.ownerCanPayFee && info.variant === "plain" && (
        <button onClick={() => run(phase, false)} disabled={!!busy} className={btn.secondary}>Submit without a wallet</button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {info.state === "ARMED" && (
        <Card><Countdown to={info.eligibleAt} label="Nothing to do yet. If the owner stays inactive, a claim can start in" />
          <p className="mt-3 text-sm text-muted">This date moves back every time the owner uses their account.</p></Card>
      )}
      {info.state === "ELIGIBLE" && (
        <Card tone="accent">
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]">The owner&apos;s inactivity window has passed</h2>
          <p className="mt-1 text-muted">Starting the claim publicly notifies the owner and begins the grace period. It moves nothing. Riktha usually does this automatically.</p>
          {buttons(1, "Start the claim")}
        </Card>
      )}
      {info.state === "NOTICE" && (
        <Card><Countdown to={info.claimableAt} label="Claim started. Unless the owner responds, you can complete the handover in" /></Card>
      )}
      {info.state === "CLAIMABLE" && (
        <Card tone="accent">
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]">You can complete the handover</h2>
          <p className="mt-1 text-muted">This adds your key as a signer on the owner&apos;s account. Then you can move the assets.</p>
          {buttons(2, "Complete the handover")}
        </Card>
      )}
      {info.state === "INHERITED" && <EstatePanel owner={info.owner} heir={info.heir} />}
      {info.state === "CANCELLED" && <Card><p>The owner used their account, so this claim was cancelled. If they re-arm their plan, you&apos;ll need the new packet.</p></Card>}
      {info.state === "REVOKED" && <Card><p>The owner revoked this plan. These transactions can never be used.</p></Card>}
      {info.state === "BROKEN" && <Card><p>The owner&apos;s account no longer matches this plan.</p></Card>}
      <p className="text-xs text-muted">&ldquo;Submit without a wallet&rdquo; lets the owner&apos;s account pay the 0.00001 XLM network fee itself.</p>
      <Status text={busy} />
      {hash && !busy && <p className="text-sm">✓ Sent. <a className={btn.link} href={explorerTxUrl(NETWORK, hash)} target="_blank" rel="noreferrer">View the transaction</a></p>}
      <ErrorBox message={error} />
    </div>
  );
}

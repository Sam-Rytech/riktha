"use client";

import { StrKey } from "@stellar/stellar-sdk";
import { useEffect, useRef, useState } from "react";
import TxReview from "@/components/TxReview";
import { parseTx } from "@/lib/core/builders";
import { NetworkName, PRESETS, PresetName } from "@/lib/core/config";
import { formatDuration } from "@/lib/core/eligibility";
import type { ExplainedTx } from "@/lib/core/explain";
import { explorerTxUrl, submit } from "@/lib/stellar/horizon";
import { signXdr } from "@/lib/wallet/freighter";
import { signIn, whoAmI } from "@/lib/wallet/session";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as NetworkName;
const presets = (Object.keys(PRESETS) as PresetName[]).filter((k) => NETWORK === "testnet" || !PRESETS[k].testnetOnly);

interface Draft { planId: string; setupXdr: string; explain: { setup: ExplainedTx; phase1: ExplainedTx; phase2: ExplainedTx }; removesStaleSigners: number }
type Step = "heir" | "timing" | "review" | "done";
type Busy = null | "building" | "signing" | "submitting" | "confirming";

const BUSY_LABEL: Record<Exclude<Busy, null>, string> = {
  building: "Checking your account and preparing the transactions…",
  signing: "Approve the transaction in Freighter…",
  submitting: "Sending to the Stellar network…",
  confirming: "Confirming the plan on chain…",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function NewPlan() {
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("heir");
  const [heir, setHeir] = useState("");
  const [heirEmail, setHeirEmail] = useState("");
  const [preset, setPreset] = useState<PresetName>(NETWORK === "testnet" ? "demo" : "d180");
  const [draft, setDraft] = useState<Draft>();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ message: string; details?: string[] }>();
  const [result, setResult] = useState<{ eligibleAt?: number; txHash: string }>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { whoAmI().then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const { I, G } = PRESETS[preset];
  const heirValid = StrKey.isValidEd25519PublicKey(heir.trim());

  async function buildDraft() {
    setError(undefined);
    setBusy("building");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heir: heir.trim(), heirEmail: heirEmail.trim(), inactivitySeconds: I, graceSeconds: G }),
      });
      const body = await res.json();
      if (!res.ok) throw Object.assign(new Error(body.error ?? "Couldn't prepare the plan"), { details: body.details });
      setDraft(body);
      setStep("review");
    } catch (e) {
      setError({ message: (e as Error).message, details: (e as { details?: string[] }).details });
    } finally {
      setBusy(null);
    }
  }

  async function signAndArm() {
    if (!draft) return;
    setError(undefined);
    try {
      setBusy("signing");
      const signed = parseTx(NETWORK, await signXdr(draft.setupXdr, NETWORK, me ?? undefined));
      setBusy("submitting");
      const sent = await submit(NETWORK, signed);
      if (!sent.ok) throw new Error(sent.error.kind === "CANCELLED"
        ? "Your account was used after this plan was prepared. Go back and prepare it again."
        : sent.error.message);
      setBusy("confirming");
      for (let i = 0; i < 8; i++) {
        const res = await fetch(`/api/plans/${draft.planId}/confirm`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: sent.hash }),
        });
        const body = await res.json();
        if (res.ok) { setResult({ eligibleAt: body.eligibleAt, txHash: sent.hash }); setStep("done"); return; }
        if (res.status !== 409) throw new Error(body.error);
        await sleep(2000);
      }
      throw new Error("The transaction was sent but the plan isn't visible yet. Refresh in a minute.");
    } catch (e) {
      setError({ message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (me === undefined) return <Shell><p className="text-muted">Loading…</p></Shell>;
  if (me === null) {
    return (
      <Shell>
        <h1 className="font-serif text-3xl">Create your inheritance plan</h1>
        <p className="mt-3 text-muted">Sign in with Freighter first, using the account you want to pass on.</p>
        <button onClick={() => signIn().then(setMe).catch((e) => setError({ message: e.message }))} className={primary + " mt-6"}>
          Sign in with Freighter
        </button>
        <ErrorBox error={error} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Progress step={step} />

      {step === "heir" && (
        <form onSubmit={(e) => { e.preventDefault(); if (heirValid) setStep("timing"); }} className="space-y-6">
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-3xl outline-none">Who should inherit this account?</h1>
          <p className="text-muted">Your heir needs their own funded Stellar account. Before the handover they have no power over yours, and their address stays off the public ledger.</p>
          <label className="block">
            <span className="text-sm font-medium">Heir&apos;s Stellar address</span>
            <input
              value={heir} onChange={(e) => setHeir(e.target.value)} required spellCheck={false} autoComplete="off"
              placeholder="G…" aria-invalid={heir !== "" && !heirValid}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            {heir !== "" && !heirValid && <span className="mt-1 block text-sm text-danger">That isn&apos;t a valid address yet. It should start with G and be 56 characters.</span>}
            {heir.trim() === me && <span className="mt-1 block text-sm text-danger">That&apos;s your own address. Choose someone else.</span>}
          </label>
          <label className="block">
            <span className="text-sm font-medium">Heir&apos;s email <span className="font-normal text-muted">(optional)</span></span>
            <input
              type="email" value={heirEmail} onChange={(e) => setHeirEmail(e.target.value)} autoComplete="off" placeholder="name@example.com"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <span className="mt-1 block text-sm text-muted">We&apos;ll send them the inheritance packet and tell them when to act.</span>
          </label>
          <button type="submit" disabled={!heirValid || heir.trim() === me} className={primary}>Continue</button>
        </form>
      )}

      {step === "timing" && (
        <div className="space-y-6">
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-3xl outline-none">How long should Riktha wait?</h1>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Inactivity window</legend>
            {presets.map((k) => (
              <label key={k} className={`cursor-pointer rounded-xl border p-4 transition-colors ${preset === k ? "border-accent bg-surface" : "border-line hover:border-muted"}`}>
                <input type="radio" name="preset" value={k} aria-label={PRESETS[k].label} checked={preset === k} onChange={() => setPreset(k)} className="sr-only" />
                <span className="flex items-center justify-between">
                  <span className="font-medium">{PRESETS[k].label}</span>
                  <span aria-hidden className={`h-4 w-4 rounded-full border ${preset === k ? "border-[5px] border-accent" : "border-line"}`} />
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {PRESETS[k].testnetOnly ? "For trying it out on testnet." : `Then ${formatDuration(PRESETS[k].G)} to respond.`}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed">
            <p><b>If you send nothing from this account for {formatDuration(I)}</b>, a claim can start. We alert you by email, Telegram and the dashboard.</p>
            <p className="mt-2"><b>You then have {formatDuration(G)}</b> to send any transaction, which cancels the claim. After that, your heir can add their key to your account.</p>
            <p className="mt-2 text-muted">Sending anything resets the clock: a payment, a trade, or the &ldquo;I&apos;m alive&rdquo; button. Receiving money doesn&apos;t count.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("heir")} className={secondary}>Back</button>
            <button onClick={buildDraft} disabled={busy !== null} className={primary}>Review plan</button>
          </div>
        </div>
      )}

      {step === "review" && draft && (
        <div className="space-y-6">
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-3xl outline-none">Review and sign</h1>
          <p className="text-muted">You sign <b>one</b> transaction now. It pre-approves two future transactions that the network will only accept if you go quiet.</p>
          <TxReview
            title="Sign now: set up the plan" badge="you sign"
            summary={`Registers two pre-approved transactions on your account. Nothing moves, and you keep full control.${draft.removesStaleSigners ? ` Also removes ${draft.removesStaleSigners} leftover approval(s) from an earlier plan.` : ""}`}
            tx={draft.explain.setup}
          />
          <TxReview
            title="Later: the notice" badge={`after ${formatDuration(I)} of silence`}
            summary="Starts the claim publicly. It changes nothing on your account except restarting the clock. Anyone can submit it once you've been quiet long enough."
            tx={draft.explain.phase1}
          />
          <TxReview
            title="Later: the handover" badge={`${formatDuration(G)} after the notice`}
            summary="Adds your heir as a signer, so they can move your assets. It only works if you've sent nothing since the notice. One transaction from you cancels it forever."
            tx={draft.explain.phase2}
          />
          <div className="flex gap-3">
            <button onClick={() => { setDraft(undefined); setStep("timing"); }} disabled={busy !== null} className={secondary}>Back</button>
            <button onClick={signAndArm} disabled={busy !== null} className={primary}>Sign &amp; arm with Freighter</button>
          </div>
        </div>
      )}

      {step === "done" && draft && result && (
        <div className="space-y-6">
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-3xl outline-none">Your plan is armed</h1>
          <div className="rounded-xl border border-accent bg-surface p-5">
            <p className="font-medium text-accent">✓ Armed on the Stellar network</p>
            <p className="mt-2">
              If you send nothing until <b>{result.eligibleAt ? new Date(result.eligibleAt * 1000).toLocaleString() : "the window ends"}</b>, a claim can start.
              Using your account normally pushes this date back.
            </p>
            <a href={explorerTxUrl(NETWORK, result.txHash)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent underline underline-offset-4">
              View the setup transaction
            </a>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-serif text-lg">Give your heir the inheritance packet</h2>
            <p className="mt-1 text-muted">It holds both pre-approved transactions, so your heir can claim even if Riktha disappears. It contains no secrets and can&apos;t be used early.</p>
            <a href={`/api/plans/${draft.planId}/packet`} download className={primary + " mt-4 inline-block"}>Download packet</a>
            {heirEmail && <p className="mt-3 text-sm text-muted">We&apos;ll also email it to {heirEmail}.</p>}
          </div>
          <a href="/dashboard" className={secondary + " inline-block"}>Go to your dashboard</a>
        </div>
      )}

      <p aria-live="polite" className="text-sm text-muted">{busy ? BUSY_LABEL[busy] : ""}</p>
      <ErrorBox error={error} />
    </Shell>
  );
}

const primary = "rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-paper hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:border-muted disabled:opacity-50";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6">{children}</main>;
}

function Progress({ step }: { step: Step }) {
  const steps: [Step, string][] = [["heir", "Heir"], ["timing", "Timing"], ["review", "Review & sign"], ["done", "Armed"]];
  const at = steps.findIndex(([s]) => s === step);
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Progress">
      {steps.map(([s, label], i) => (
        <li key={s} aria-current={i === at ? "step" : undefined} className={i === at ? "font-medium text-ink" : i < at ? "text-accent" : "text-muted"}>
          {i < at ? "✓ " : `${i + 1}. `}{label}
        </li>
      ))}
    </ol>
  );
}

function ErrorBox({ error }: { error?: { message: string; details?: string[] } }) {
  if (!error) return null;
  const extra = (error.details ?? []).filter((d) => d !== error.message);
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
      <p>{error.message}</p>
      {extra.length > 0 && <ul className="mt-2 list-disc pl-5">{extra.map((d) => <li key={d}>{d}</li>)}</ul>}
    </div>
  );
}

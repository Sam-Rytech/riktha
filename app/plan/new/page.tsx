"use client";

import { StrKey } from "@stellar/stellar-sdk";
import { useEffect, useRef, useState } from "react";
import TxReview from "@/components/TxReview";
import { AppMain, btn, ErrorBox as UiErrorBox, inputCls } from "@/components/ui";
import { newHeirKit } from "@/lib/core/claimkit";
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
type Busy = null | "locking" | "building" | "signing" | "submitting" | "confirming";
type HeirKind = "wallet" | "kit";

const BUSY_LABEL: Record<Exclude<Busy, null>, string> = {
  locking: "Creating your heir's claim key and locking it with a code (this takes a moment)…",
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
  const [heirKind, setHeirKind] = useState<HeirKind>("kit");
  const [claimCode, setClaimCode] = useState<string>();
  const [codeSaved, setCodeSaved] = useState(false);
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
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(heirEmail.trim());
  const heirStepValid = heirKind === "kit" ? emailValid : heirValid && heir.trim() !== me;

  async function buildDraft() {
    setError(undefined);
    try {
      let heirFields: Record<string, unknown> = { heir: heir.trim() };
      if (heirKind === "kit") {
        // The heir key and claim code are created here, in your browser; only the locked kit is sent.
        setBusy("locking");
        const k = await newHeirKit(me!);
        heirFields = { heir: k.heirPublic, heirKit: k.kit };
        setClaimCode(k.code);
        setCodeSaved(false);
      }
      setBusy("building");
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...heirFields, heirEmail: heirEmail.trim(), inactivitySeconds: I, graceSeconds: G }),
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
        <h1 className="headline text-[30px] sm:text-[40px]">Create your inheritance plan</h1>
        <p className="mt-3 text-muted">Sign in with Freighter first, using the account you want to pass on.</p>
        <button onClick={() => signIn().then(setMe).catch((e) => setError({ message: e.message }))} className={primary + " mt-6"}>
          Sign in with Freighter
        </button>
        <ErrorBox error={error} />
      </Shell>
    );
  }

  return (
    <Shell step={step}>

      {step === "heir" && (
        <form onSubmit={(e) => { e.preventDefault(); if (heirStepValid) setStep("timing"); }} className="space-y-6">
          <h1 ref={headingRef} tabIndex={-1} className="headline text-[30px] outline-none sm:text-[40px]">Who should inherit this account?</h1>
          <p className="rounded-2xl bg-stone px-4 py-3 text-[14px]">You&apos;re creating a plan for <b className="font-mono" title={me}>{me.slice(0, 4)}…{me.slice(-4)}</b>, the account you&apos;re signed in with.</p>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-3 text-[14px] font-medium">Does your heir use crypto?</legend>
            {([
              ["kit", "No, they don't use crypto", "Name them by email. They'll claim with a 6-word code you give them. No wallet needed, ever."],
              ["wallet", "Yes, they have a Stellar wallet", "They'll claim with their own wallet, such as Freighter."],
            ] as [HeirKind, string, string][]).map(([k, label, desc]) => (
              <label key={k} className={`cursor-pointer rounded-[var(--radius-card)] border-2 p-5 transition-colors ${heirKind === k ? "border-green bg-green-tint" : "border-line hover:border-ink/30"}`}>
                <input type="radio" name="heirKind" value={k} aria-label={label} checked={heirKind === k} onChange={() => setHeirKind(k)} className="sr-only" />
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{label}</span>
                  <span aria-hidden className={`h-4 w-4 shrink-0 rounded-full border ${heirKind === k ? "border-[6px] border-green" : "border-line"}`} />
                </span>
                <span className="mt-1 block text-[14px] text-muted">{desc}</span>
              </label>
            ))}
          </fieldset>

          {heirKind === "wallet" && (
            <label className="block">
              <span className="text-[14px] font-medium">Heir&apos;s Stellar address</span>
              <input
                value={heir} onChange={(e) => setHeir(e.target.value)} required spellCheck={false} autoComplete="off"
                placeholder="G…" aria-invalid={heir !== "" && !heirValid}
                className={inputCls + " mt-1.5 font-mono"}
              />
              <span className="mt-1 block text-[14px] text-muted">Their account must already exist. Before the handover they have no power over yours, and their address stays off the public ledger.</span>
              {heir !== "" && !heirValid && <span className="mt-1 block text-[14px] text-oxblood">That isn&apos;t a valid address yet. It should start with G and be 56 characters.</span>}
              {heir.trim() === me && <span className="mt-1 block text-[14px] text-oxblood">That&apos;s your own address. Choose someone else.</span>}
            </label>
          )}
          <label className="block">
            <span className="text-[14px] font-medium">Heir&apos;s email {heirKind === "wallet" && <span className="font-normal text-muted">(optional)</span>}</span>
            <input
              type="email" value={heirEmail} onChange={(e) => setHeirEmail(e.target.value)} autoComplete="off" placeholder="name@example.com"
              required={heirKind === "kit"} className={inputCls + " mt-1.5"}
            />
            <span className="mt-1 block text-[14px] text-muted">
              {heirKind === "kit"
                ? "We'll tell them they've been named, and email them a link when it's time to claim."
                : "We'll send them the inheritance packet and tell them when to act."}
            </span>
          </label>
          <button type="submit" disabled={!heirStepValid} className={primary}>Continue</button>
        </form>
      )}

      {step === "timing" && (
        <div className="space-y-6">
          <h1 ref={headingRef} tabIndex={-1} className="headline text-[30px] outline-none sm:text-[40px]">How long should Riktha wait?</h1>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Inactivity window</legend>
            {presets.map((k) => (
              <label key={k} className={`cursor-pointer rounded-[var(--radius-card)] border-2 p-5 transition-colors ${preset === k ? "border-green bg-green-tint" : "border-line hover:border-ink/30"}`}>
                <input type="radio" name="preset" value={k} aria-label={PRESETS[k].label} checked={preset === k} onChange={() => setPreset(k)} className="sr-only" />
                <span className="flex items-center justify-between">
                  <span className="font-medium">{PRESETS[k].label}</span>
                  <span aria-hidden className={`h-4 w-4 rounded-full border ${preset === k ? "border-[6px] border-green" : "border-line"}`} />
                </span>
                <span className="mt-1 block text-[14px] text-muted">
                  {PRESETS[k].testnetOnly ? "For trying it out on testnet." : `Then ${formatDuration(PRESETS[k].G)} to respond.`}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="rounded-[var(--radius-card)] bg-stone p-5 text-[15px] leading-relaxed">
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
          <h1 ref={headingRef} tabIndex={-1} className="headline text-[30px] outline-none sm:text-[40px]">Review and sign</h1>
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
            summary={`Adds ${heirKind === "kit" ? "your heir's claim key" : "your heir"} as a signer, so they can move your assets. It only works if you've sent nothing since the notice. One transaction from you cancels it forever.`}
            tx={draft.explain.phase2}
          />
          {heirKind === "kit" && claimCode && <ClaimCodeCard code={claimCode} saved={codeSaved} onSaved={setCodeSaved} email={heirEmail.trim()} />}
          <div className="flex gap-3">
            <button onClick={() => { setDraft(undefined); setClaimCode(undefined); setStep("timing"); }} disabled={busy !== null} className={secondary}>Back</button>
            <button onClick={signAndArm} disabled={busy !== null || (heirKind === "kit" && !codeSaved)} className={primary}>Sign &amp; arm with Freighter</button>
          </div>
        </div>
      )}

      {step === "done" && draft && result && (
        <div className="space-y-6">
          <h1 ref={headingRef} tabIndex={-1} className="headline text-[30px] outline-none sm:text-[40px]">Your plan is armed</h1>
          <div className="rounded-[var(--radius-card)] border border-green/30 bg-green-tint p-6">
            <p className="font-medium text-green">✓ Armed on the Stellar network</p>
            <p className="mt-2">
              If you send nothing until <b>{result.eligibleAt ? new Date(result.eligibleAt * 1000).toLocaleString() : "the window ends"}</b>, a claim can start.
              Using your account normally pushes this date back.
            </p>
            <a href={explorerTxUrl(NETWORK, result.txHash)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[14px] text-green underline underline-offset-4">
              View the setup transaction
            </a>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line p-6">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Give your heir the inheritance packet</h2>
            <p className="mt-1 text-muted">It holds both pre-approved transactions, so your heir can claim even if Riktha disappears. It contains no secrets and can&apos;t be used early.</p>
            <a href={`/api/plans/${draft.planId}/packet`} download className={primary + " mt-4 inline-block"}>Download packet</a>
            {heirEmail && <p className="mt-3 text-[14px] text-muted">We&apos;ll also email it to {heirEmail}.</p>}
          </div>
          {heirKind === "kit" && (
            <div className="rounded-[var(--radius-card)] border border-line p-6">
              <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Pass on the claim code privately</h2>
              <p className="mt-1 text-muted">We never see your code and can&apos;t recover it. Put it with your will, or in a sealed letter for {heirEmail}. If it&apos;s ever exposed, change your heir to get a new code.</p>
            </div>
          )}
          <a href="/dashboard" className={secondary + " inline-block"}>Go to your dashboard</a>
        </div>
      )}

      <p aria-live="polite" className="text-[14px] text-muted">{busy ? BUSY_LABEL[busy] : ""}</p>
      <ErrorBox error={error} />
    </Shell>
  );
}

const primary = btn.primary;
const secondary = btn.secondary;

const STEPS: [Step, string, string][] = [
  ["heir", "Heir", "Who inherits, and how they'll claim"],
  ["timing", "Timing", "How long Riktha waits before a claim"],
  ["review", "Review & sign", "One signature, everything spelled out"],
  ["done", "Armed", "Hand over the packet and the code"],
];

function Shell({ children, step }: { children: React.ReactNode; step?: Step }) {
  return (
    <AppMain>
      <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:sticky lg:top-24">
          <p className="text-[14px] text-muted">New inheritance plan</p>
          <ol className="mt-4 space-y-1" aria-label="Progress">
            {STEPS.map(([key, label, hint], i) => {
              const at = STEPS.findIndex(([k]) => k === step);
              const done = step !== undefined && i < at, active = key === step;
              return (
                <li key={key} aria-current={active ? "step" : undefined} className={`rounded-xl px-3 py-2.5 ${active ? "bg-stone" : ""}`}>
                  <p className={`flex items-center gap-3 text-[15px] font-medium ${active ? "text-ink" : done ? "text-green" : "text-muted"}`}>
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-current font-mono text-[11px]">{done ? "✓" : i + 1}</span>{label}
                  </p>
                  {active && <p className="mt-1 pl-9 text-[13px] text-muted">{hint}</p>}
                </li>
              );
            })}
          </ol>
        </aside>
        <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-10">
          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </AppMain>
  );
}

function ErrorBox({ error }: { error?: { message: string; details?: string[] } }) {
  return <UiErrorBox message={error?.message} details={error?.details} />;
}

const esc = (x: string) => x.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

function ClaimCodeCard({ code, saved, onSaved, email }: { code: string; saved: boolean; onSaved: (v: boolean) => void; email: string }) {
  const words = code.split(" ");
  const print = () => {
    const w = window.open("", "_blank", "width=600,height=500");
    if (!w) return;
    w.document.write(`<title>Riktha claim code</title><body style="font-family:Georgia,serif;padding:40px"><h1>Riktha claim code</h1><p>For: ${esc(email)}</p><ol style="font-size:22px;line-height:1.8">${words.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p>Keep this private. With it, ${esc(email)} can claim my Stellar account at the link Riktha emails them, but only if I stop using my account.</p></body>`);
    w.document.close();
    w.print();
  };
  return (
    <section className="rounded-[var(--radius-card)] border-2 border-ink p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[19px] font-semibold tracking-[-0.01em]">Your heir&apos;s claim code</h3>
        <span className="font-mono text-[12px] text-muted">shown once</span>
      </div>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">Write these six words down in order and keep them with your will. Your heir needs them to claim. Riktha never sees them.</p>
      <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {words.map((w, i) => (
          <li key={i} className="rounded-xl bg-stone px-4 py-3 font-mono text-[17px]"><span className="mr-3 text-[12px] text-muted">{i + 1}</span>{w}</li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" onClick={print} className={btn.secondary}>Print</button>
        <label className="flex cursor-pointer items-center gap-3 text-[15px]">
          <input type="checkbox" checked={saved} onChange={(e) => onSaved(e.target.checked)} className="h-5 w-5 accent-[var(--green)]" />
          I&apos;ve written down the code and will keep it safe
        </label>
      </div>
    </section>
  );
}

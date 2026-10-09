"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import Inbox from "@/components/Inbox";
import TxReview from "@/components/TxReview";
import { btn, Card, Countdown, ErrorBox, fmtDate, short, StateBadge, Status, Timeline } from "@/components/ui";
import { checkIn, NETWORK, signAndSubmit } from "@/lib/client/actions";
import { api, confirmPlan, type Draft, type InboxItem, type PlanView } from "@/lib/client/api";
import { formatDuration } from "@/lib/core/eligibility";
import { explorerTxUrl } from "@/lib/stellar/horizon";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <AuthGate title="Your dashboard" intro="Sign in with the account your plan protects.">
        {(me) => <Dashboard me={me} />}
      </AuthGate>
    </main>
  );
}

function Dashboard({ me }: { me: string }) {
  const [plan, setPlan] = useState<PlanView | null>();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<{ message: string; details?: string[] }>();
  const [lastTx, setLastTx] = useState<string>();
  const [draft, setDraft] = useState<Draft>();
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const load = useCallback(async () => {
    const [{ plans }, { notifications }] = await Promise.all([
      api<{ plans: PlanView[] }>("/api/plans"),
      api<{ notifications: InboxItem[] }>("/api/notifications"),
    ]);
    setPlan(plans[0] ?? null);
    setInbox(notifications);
    if (notifications.some((n) => !n.readAt)) api("/api/notifications", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    load().catch((e) => setError({ message: e.message }));
    const t = setInterval(() => load().catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function run(label: string, fn: () => Promise<string | void>) {
    setError(undefined);
    setBusy(label);
    try {
      const hash = await fn();
      if (hash) setLastTx(hash);
      await new Promise((r) => setTimeout(r, 1500)); // let Horizon catch up
      await load();
    } catch (e) {
      setError({ message: (e as Error).message, details: (e as { details?: string[] }).details });
    } finally {
      setBusy(undefined);
    }
  }

  const aliveAction = () => run("Sending your check-in…", () => checkIn(me));
  const startRearm = () => run("Preparing a fresh plan…", async () => { setDraft(await api<Draft>(`/api/plans/${plan!.id}/rearm`, { method: "POST", json: {} })); });
  const signRearm = () => run("Approve in Freighter, then confirming on chain…", async () => {
    const hash = await signAndSubmit(draft!.setupXdr, me);
    await confirmPlan(draft!.planId, hash);
    setDraft(undefined);
    return hash;
  });
  const revoke = () => run("Approve in Freighter, then confirming on chain…", async () => {
    const { revokeXdr } = await api<{ revokeXdr: string }>(`/api/plans/${plan!.id}/revoke`);
    const hash = await signAndSubmit(revokeXdr, me);
    for (let i = 0; i < 6; i++) {
      try { await api(`/api/plans/${plan!.id}/revoke`, { method: "POST", json: { txHash: hash } }); break; }
      catch (e) { if (i === 5) throw e; await new Promise((r) => setTimeout(r, 2000)); }
    }
    setConfirmRevoke(false);
    return hash;
  });

  if (plan === undefined) return <p className="text-muted">Loading your plan…</p>;
  if (plan === null) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl">No plan yet</h1>
        <p className="text-muted">Create a plan to name an heir for {short(me)}. It takes one signature.</p>
        <Link href="/plan/new" className={btn.primary}>Create your plan</Link>
        <Inbox items={inbox} />
      </div>
    );
  }

  const s = plan.state;
  const urgent = s === "NOTICE" || s === "CLAIMABLE";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Your plan</h1>
        <StateBadge state={s} />
      </div>

      {urgent && (
        <Card tone="danger">
          <h2 className="font-serif text-xl text-danger">A claim on your account has started</h2>
          <p className="mt-2">
            {s === "NOTICE"
              ? <>Your heir can take over on <b>{fmtDate(plan.claimableAt)}</b> unless you act. If you&apos;re here, cancel it now.</>
              : <>The grace period is over and your heir can take over at any moment. Cancel now if you&apos;re still here.</>}
          </p>
          <button onClick={aliveAction} disabled={!!busy} className={btn.danger + " mt-4"}>Cancel the claim</button>
          <p className="mt-2 text-sm text-muted">Any transaction you send cancels the claim for good. You&apos;ll then re-arm your plan.</p>
        </Card>
      )}

      <Timeline state={s} />

      {(s === "ARMED" || s === "ELIGIBLE") && (
        <Card tone={s === "ELIGIBLE" ? "danger" : "accent"}>
          <Countdown to={plan.eligibleAt} label={s === "ELIGIBLE" ? "Your inactivity window has passed. Check in now." : "A claim can start in"} />
          <p className="mt-3 text-sm text-muted">Last activity: {fmtDate(plan.seqTime)}. Any transaction you send resets this clock; received payments don&apos;t.</p>
          <button onClick={aliveAction} disabled={!!busy} className={btn.primary + " mt-4"}>I&apos;m alive</button>
        </Card>
      )}

      {urgent && s === "NOTICE" && <Card><Countdown to={plan.claimableAt} label="Your heir can take over in" /></Card>}

      {s === "CANCELLED" && (
        <Card>
          <h2 className="font-serif text-xl">The claim was cancelled</h2>
          <p className="mt-1 text-muted">Your plan no longer protects you. Re-arm it with the same heir and windows; it takes one signature.</p>
          {!draft && <button onClick={startRearm} disabled={!!busy} className={btn.primary + " mt-4"}>Re-arm plan</button>}
        </Card>
      )}

      {s === "INHERITED" && <Card><h2 className="font-serif text-xl">Your heir is now a signer on this account</h2><p className="mt-1 text-muted">Your own key still works. To remove your heir, use any Stellar wallet&apos;s signer settings.</p></Card>}
      {s === "REVOKED" && <Card><h2 className="font-serif text-xl">Plan revoked</h2><p className="mt-1 text-muted">No Riktha approvals remain on your account.</p><Link href="/plan/new" className={btn.primary + " mt-4"}>Create a new plan</Link></Card>}
      {s === "BROKEN" && <ErrorBox message="Your account no longer matches this plan. Re-arm it to fix it." details={plan.diagnostics} />}

      {draft && (
        <div className="space-y-3">
          <TxReview title="Sign now: re-arm the plan" badge="you sign" tx={draft.explain.setup}
            summary={`Removes ${draft.removesStaleSigners} leftover approval(s) and registers a fresh pair. Nothing moves.`} />
          <div className="flex gap-3">
            <button onClick={() => setDraft(undefined)} disabled={!!busy} className={btn.secondary}>Cancel</button>
            <button onClick={signRearm} disabled={!!busy} className={btn.primary}>Sign &amp; re-arm</button>
          </div>
        </div>
      )}

      <Status text={busy} />
      {lastTx && !busy && <p className="text-sm">✓ Done · <a className={btn.link} href={explorerTxUrl(NETWORK, lastTx)} target="_blank" rel="noreferrer">view transaction</a></p>}
      <ErrorBox message={error?.message} details={error?.details} />

      <Card>
        <h2 className="font-serif text-xl">Plan details</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Detail k="Heir" v={<span className="font-mono" title={plan.heir}>{short(plan.heir)}</span>} />
          <Detail k="Heir email" v={plan.heirEmail || "—"} />
          <Detail k="Inactivity window" v={formatDuration(plan.inactivitySeconds)} />
          <Detail k="Grace window" v={formatDuration(plan.graceSeconds)} />
          <Detail k="Version" v={`v${plan.version}`} />
          <Detail k="Armed" v={fmtDate(Math.floor(new Date(plan.createdAt).getTime() / 1000))} />
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <a href={`/api/plans/${plan.id}/packet`} download className={btn.secondary}>Download packet</a>
          {plan.setupTxHash && <a className={btn.link} href={explorerTxUrl(NETWORK, plan.setupTxHash)} target="_blank" rel="noreferrer">Setup transaction</a>}
          {!["REVOKED", "INHERITED"].includes(s) && <Link className={btn.link} href="/plan/new">Change heir or windows</Link>}
          {!["REVOKED", "INHERITED"].includes(s) && !confirmRevoke && <button onClick={() => setConfirmRevoke(true)} className="text-sm text-danger underline underline-offset-4">Revoke plan</button>}
        </div>
        {confirmRevoke && (
          <div className="mt-4 rounded-lg border border-danger/40 p-4 text-sm">
            <p>Revoking removes every Riktha approval from your account. Your heir&apos;s packet stops working. Continue?</p>
            <div className="mt-3 flex gap-3">
              <button onClick={() => setConfirmRevoke(false)} className={btn.secondary}>Keep plan</button>
              <button onClick={revoke} disabled={!!busy} className={btn.danger}>Revoke</button>
            </div>
          </div>
        )}
      </Card>

      <Inbox items={inbox} />
    </div>
  );
}

function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>;
}

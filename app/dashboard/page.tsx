"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import Inbox from "@/components/Inbox";
import TxReview from "@/components/TxReview";
import { AppMain, btn, Card, CountdownRing, ErrorBox, fmtDate, NightPanel, short, StateBadge, Status, Timeline } from "@/components/ui";
import { checkIn, NETWORK, signAndSubmit } from "@/lib/client/actions";
import { api, confirmPlan, type Draft, type InboxItem, type PlanView } from "@/lib/client/api";
import { formatDuration } from "@/lib/core/eligibility";
import { explorerTxUrl } from "@/lib/stellar/horizon";

export default function DashboardPage() {
  return (
    <AppMain>
      <AuthGate title="Your dashboard" intro="Sign in with the account your plan protects.">
        {(me) => <Dashboard me={me} />}
      </AuthGate>
    </AppMain>
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

  if (plan === undefined) return <div className="h-72 animate-pulse rounded-[var(--radius-slab)] bg-surface/60" aria-label="Loading your plan" />;
  if (plan === null) {
    return (
      <>
        <NightPanel className="py-12 sm:py-16">
          <h1 className="headline max-w-xl text-[32px] sm:text-[48px]">No plan yet</h1>
          <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-white/65">Name an heir for <span className="font-mono">{short(me)}</span>. It takes about two minutes and one signature.</p>
          <Link href="/plan/new" className={btn.light + " mt-7"}>Create your plan</Link>
        </NightPanel>
        <Inbox items={inbox} />
      </>
    );
  }

  const s = plan.state;
  const urgent = s === "NOTICE" || s === "CLAIMABLE";
  const active = !["REVOKED", "INHERITED"].includes(s);
  return (
    <>
      {urgent && (
        <section role="alert" className="rounded-[var(--radius-slab)] bg-oxblood p-6 text-white sm:p-9">
          <h2 className="headline text-[28px] sm:text-[40px]">A claim on your account has started</h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-white/85">
            {s === "NOTICE"
              ? <>Your heir can take over on <b>{fmtDate(plan.claimableAt)}</b> unless you act. If you&apos;re reading this, cancel it now.</>
              : <>The grace period is over and your heir can take over at any moment. Cancel now if you&apos;re still here.</>}
          </p>
          <button onClick={aliveAction} disabled={!!busy} className={btn.light + " mt-6"}>Cancel the claim</button>
          <p className="mt-3 text-[14px] text-white/70">Any transaction you send cancels it for good. You&apos;ll then re-arm your plan.</p>
        </section>
      )}

      <NightPanel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[14px] text-white/55">Plan for <span className="font-mono">{short(me)}</span></p>
            <h1 className="headline mt-1 text-[32px] sm:text-[44px]">Your plan</h1>
          </div>
          <StateBadge state={s} onNight />
        </div>
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            {(s === "ARMED" || s === "ELIGIBLE") && (
              <CountdownRing onNight to={plan.eligibleAt} total={plan.inactivitySeconds}
                label={s === "ELIGIBLE" ? "Your window has passed. Check in now." : "A claim can start in"} />
            )}
            {s === "NOTICE" && <CountdownRing onNight to={plan.claimableAt} total={plan.graceSeconds} label="Your heir can take over in" />}
            {s === "CLAIMABLE" && <p className="text-[19px] text-white/80">The grace period has ended.</p>}
            {s === "CANCELLED" && <p className="max-w-lg text-[17px] leading-relaxed text-white/75">The claim was cancelled, so your plan no longer protects you. Re-arm it with the same heir and windows; it takes one signature.</p>}
            {s === "INHERITED" && <p className="max-w-lg text-[17px] leading-relaxed text-white/75">Your heir is now a signer on this account. Your own key still works.</p>}
            {s === "REVOKED" && <p className="max-w-lg text-[17px] leading-relaxed text-white/75">No Riktha approvals remain on your account.</p>}
            {s === "BROKEN" && <p className="max-w-lg text-[17px] leading-relaxed text-white/75">Your account no longer matches this plan. Re-arm it to fix it.</p>}
            {(s === "ARMED" || s === "ELIGIBLE") && <p className="mt-5 text-[14px] text-white/55">Last activity {fmtDate(plan.seqTime)}. Any transaction you send resets the clock; received payments don&apos;t.</p>}
          </div>
          <div className="flex flex-wrap gap-3 lg:flex-col">
            {(s === "ARMED" || s === "ELIGIBLE") && <button onClick={aliveAction} disabled={!!busy} className={btn.light}>I&apos;m alive</button>}
            {(s === "CANCELLED" || s === "BROKEN") && !draft && <button onClick={startRearm} disabled={!!busy} className={btn.light}>Re-arm plan</button>}
            {s === "REVOKED" && <Link href="/plan/new" className={btn.light}>Create a new plan</Link>}
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6"><Timeline state={s} onNight /></div>
      </NightPanel>

      {draft && (
        <Card tone="accent">
          <TxReview title="Sign now: re-arm the plan" badge="you sign" tx={draft.explain.setup}
            summary={`Removes ${draft.removesStaleSigners} leftover approval(s) and registers a fresh pair. Nothing moves.`} />
          <div className="mt-4 flex gap-3">
            <button onClick={() => setDraft(undefined)} disabled={!!busy} className={btn.secondary}>Cancel</button>
            <button onClick={signRearm} disabled={!!busy} className={btn.primary}>Sign &amp; re-arm</button>
          </div>
        </Card>
      )}

      <Status text={busy} />
      {lastTx && !busy && <p className="text-[15px]">✓ Done. <a className={btn.link} href={explorerTxUrl(NETWORK, lastTx)} target="_blank" rel="noreferrer">View the transaction</a></p>}
      <ErrorBox message={error?.message} details={error?.details} />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Plan details</h2>
          <dl className="mt-4 divide-y divide-line text-[15px]">
            <Detail k="Heir" v={plan.heirKind === "kit" ? "Claim kit (no wallet needed)" : <span className="font-mono" title={plan.heir}>{short(plan.heir)}</span>} />
            <Detail k="Heir email" v={plan.heirEmail || "Not set"} />
            <Detail k="Inactivity window" v={formatDuration(plan.inactivitySeconds)} />
            <Detail k="Grace window" v={formatDuration(plan.graceSeconds)} />
            <Detail k="Version" v={`v${plan.version}`} />
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a href={`/api/plans/${plan.id}/packet`} download className={btn.secondary}>Download packet</a>
            {active && <Link className={btn.secondary} href="/plan/new">Change heir or windows</Link>}
            {plan.setupTxHash && <a className={btn.link} href={explorerTxUrl(NETWORK, plan.setupTxHash)} target="_blank" rel="noreferrer">Setup transaction</a>}
          </div>
          {active && (
            <div className="mt-6 border-t border-line pt-5">
              {!confirmRevoke ? (
                <button onClick={() => setConfirmRevoke(true)} className="text-[14px] text-oxblood underline decoration-oxblood/30 underline-offset-4 hover:decoration-oxblood">Revoke plan</button>
              ) : (
                <div className="rounded-2xl bg-oxblood-tint p-4 text-[15px]">
                  <p>Revoking removes every Riktha approval from your account, and your heir&apos;s packet stops working. Continue?</p>
                  <div className="mt-3 flex gap-3">
                    <button onClick={() => setConfirmRevoke(false)} className={btn.secondary}>Keep plan</button>
                    <button onClick={revoke} disabled={!!busy} className={btn.danger}>Revoke</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
        <Inbox items={inbox} />
      </div>
    </>
  );
}

function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>;
}

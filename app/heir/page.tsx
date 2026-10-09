"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import ClaimActions from "@/components/ClaimActions";
import Inbox from "@/components/Inbox";
import { btn, Card, ErrorBox, short, StateBadge } from "@/components/ui";
import { api, type InboxItem, type PlanView } from "@/lib/client/api";
import { formatDuration } from "@/lib/core/eligibility";

export default function HeirPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <AuthGate title="Plans naming you" intro="Sign in with the account an owner named as their heir.">
        {() => <Heir />}
      </AuthGate>
    </main>
  );
}

function Heir() {
  const [plans, setPlans] = useState<PlanView[]>();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const [{ plans }, { notifications }] = await Promise.all([
      api<{ plans: PlanView[] }>("/api/heir/plans"),
      api<{ notifications: InboxItem[] }>("/api/notifications"),
    ]);
    setPlans(plans);
    setInbox(notifications);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const t = setInterval(() => load().catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, [load]);

  if (!plans) return <><p className="text-muted">Loading…</p><ErrorBox message={error} /></>;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Plans naming you</h1>
      {plans.length === 0 && (
        <Card>
          <p>No plans name this account yet.</p>
          <p className="mt-1 text-sm text-muted">If you were sent an inheritance packet for a different account, use <Link className={btn.link} href="/claim">Claim with a packet</Link>.</p>
        </Card>
      )}
      {plans.map((p) => (
        <section key={p.id} className="space-y-4 rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl">Account <span className="font-mono text-base" title={p.owner}>{short(p.owner)}</span></h2>
              <p className="text-sm text-muted">Inactivity {formatDuration(p.inactivitySeconds)} · grace {formatDuration(p.graceSeconds)}</p>
            </div>
            <StateBadge state={p.state} />
          </div>
          <ClaimActions info={{ ...p, variant: p.variant }} onChanged={() => load().catch(() => {})} />
          <a href={`/api/plans/${p.id}/packet`} download className={btn.link}>Download inheritance packet</a>
        </section>
      ))}
      <ErrorBox message={error} />
      <Inbox items={inbox} />
    </div>
  );
}

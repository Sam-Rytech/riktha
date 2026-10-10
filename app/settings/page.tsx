"use client";

import { useCallback, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { btn, Card, ErrorBox, Status } from "@/components/ui";
import { api } from "@/lib/client/api";

interface Contact {
  email: string | null; emailVerified: boolean; telegramLinked: boolean;
  channels: { email: boolean; telegram: boolean }; telegramBot: string;
}

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-5 px-6 pb-6 pt-8 sm:px-10 sm:pt-12 *:max-w-3xl">
      <AuthGate title="Notification settings" intro="Sign in to choose where Riktha sends reminders and alerts.">
        {() => <Settings />}
      </AuthGate>
    </main>
  );
}

function Settings() {
  const [c, setC] = useState<Contact>();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string>();
  const verified = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("verified");
  const [note, setNote] = useState<string | undefined>(verified === "1" ? "✓ Email confirmed. You'll get reminders there." : undefined);
  const [error, setError] = useState<string | undefined>(verified === "0" ? "That confirmation link is invalid or was already used." : undefined);

  const load = useCallback(async () => {
    const contact = await api<Contact>("/api/contacts");
    setC(contact);
    return contact;
  }, []);

  useEffect(() => {
    load().then((x) => setEmail(x.email ?? "")).catch((e) => setError(e.message));
  }, [load]);

  async function run(label: string, fn: () => Promise<void>) {
    setError(undefined); setNote(undefined); setBusy(label);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(undefined); }
  }

  const saveEmail = () => run("Sending confirmation email…", async () => {
    setC(await api<Contact>("/api/contacts", { method: "PUT", json: { email: email.trim() } }));
    setNote("Check your inbox (and spam folder) for the confirmation link.");
  });
  const removeEmail = () => run("Removing…", async () => { setC(await api<Contact>("/api/contacts", { method: "PUT", json: { email: null } })); setEmail(""); });
  const linkTelegram = () => run("Opening Telegram…", async () => {
    const { url } = await api<{ url: string }>("/api/telegram/link", { method: "POST" });
    window.open(url, "_blank", "noopener");
    setNote("Press Start in Telegram. This page updates once the chat is linked.");
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      if ((await load()).telegramLinked) { setNote("✓ Telegram linked."); return; }
    }
  });
  const unlinkTelegram = () => run("Unlinking…", async () => { setC(await api<Contact>("/api/telegram/link", { method: "DELETE" })); });

  if (!c) return <><p className="text-muted">Loading…</p><ErrorBox message={error} /></>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="headline text-[30px] sm:text-[40px]">Notification settings</h1>
        <p className="mt-2 text-muted">Alerts always appear on your dashboard. Add email and Telegram so a claim can never start without you hearing about it.</p>
      </div>

      <Card>
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Email</h2>
        {!c.channels.email && <p className="mt-1 text-sm text-danger">Email isn&apos;t configured on this server yet.</p>}
        <p className="mt-1 text-sm text-muted">
          {c.email ? (c.emailVerified ? `✓ Confirmed: ${c.email}` : `Waiting for confirmation: ${c.email}`) : "No email added."}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); saveEmail(); }} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Email address</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-accent" />
          </label>
          <button type="submit" disabled={!!busy || !c.channels.email} className={btn.primary}>{c.email ? "Update" : "Add email"}</button>
        </form>
        {c.email && <button onClick={removeEmail} disabled={!!busy} className="mt-3 text-sm text-danger underline underline-offset-4">Remove email</button>}
      </Card>

      <Card>
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Telegram</h2>
        {!c.channels.telegram && <p className="mt-1 text-sm text-danger">Telegram isn&apos;t configured on this server yet.</p>}
        <p className="mt-1 text-sm text-muted">{c.telegramLinked ? `✓ Linked to @${c.telegramBot}. Send /status there any time.` : `Get alerts from @${c.telegramBot}.`}</p>
        <div className="mt-4">
          {c.telegramLinked
            ? <button onClick={unlinkTelegram} disabled={!!busy} className={btn.secondary}>Unlink Telegram</button>
            : <button onClick={linkTelegram} disabled={!!busy || !c.channels.telegram} className={btn.primary}>Link Telegram</button>}
        </div>
      </Card>

      <Status text={busy} />
      {note && <p role="status" className="text-sm text-green">{note}</p>}
      <ErrorBox message={error} />
    </div>
  );
}

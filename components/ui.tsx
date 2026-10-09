"use client";

import { useEffect, useState } from "react";

export const btn = {
  primary: "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-paper hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:border-muted disabled:cursor-not-allowed disabled:opacity-50",
  danger: "inline-flex items-center justify-center rounded-full bg-danger px-5 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  link: "text-sm text-accent underline underline-offset-4 hover:no-underline",
};

export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const fmtDate = (unix?: number) => (unix ? new Date(unix * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export function Card({ children, className = "", tone = "plain" }: { children: React.ReactNode; className?: string; tone?: "plain" | "accent" | "danger" }) {
  const border = tone === "accent" ? "border-accent" : tone === "danger" ? "border-danger/60 bg-danger/5" : "border-line";
  return <section className={`rounded-xl border ${border} ${tone === "danger" ? "" : "bg-surface"} p-5 ${className}`}>{children}</section>;
}

export function ErrorBox({ message, details }: { message?: string; details?: string[] }) {
  if (!message) return null;
  const extra = (details ?? []).filter((d) => d !== message);
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
      <p>{message}</p>
      {extra.length > 0 && <ul className="mt-2 list-disc pl-5">{extra.map((d) => <li key={d}>{d}</li>)}</ul>}
    </div>
  );
}

export function Status({ text }: { text?: string }) {
  return <p aria-live="polite" className="min-h-5 text-sm text-muted">{text ?? ""}</p>;
}

/** Re-renders every second; returns unix seconds. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function Countdown({ to, label }: { to?: number; label: string }) {
  const now = useNow();
  if (!to) return null;
  const left = to - now;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-serif text-3xl tabular-nums sm:text-4xl" aria-live="off">{left > 0 ? formatRemaining(left) : "Now"}</p>
      <p className="text-sm text-muted">{fmtDate(to)}</p>
    </div>
  );
}

const STATE: Record<string, { label: string; tone: string; mark: string }> = {
  DRAFT: { label: "Draft", tone: "border-line text-muted", mark: "○" },
  ARMED: { label: "Armed", tone: "border-accent text-accent", mark: "●" },
  ELIGIBLE: { label: "Window passed", tone: "border-danger text-danger", mark: "!" },
  NOTICE: { label: "Claim started", tone: "border-danger text-danger", mark: "!" },
  CLAIMABLE: { label: "Handover possible", tone: "border-danger text-danger", mark: "!" },
  INHERITED: { label: "Handed over", tone: "border-ink text-ink", mark: "✓" },
  CANCELLED: { label: "Cancelled · re-arm needed", tone: "border-muted text-muted", mark: "×" },
  REVOKED: { label: "Revoked", tone: "border-muted text-muted", mark: "×" },
  BROKEN: { label: "Needs attention", tone: "border-danger text-danger", mark: "?" },
  SUPERSEDED: { label: "Replaced", tone: "border-line text-muted", mark: "○" },
};

/** Text + symbol, never colour alone (PRD §9). */
export function StateBadge({ state }: { state: string }) {
  const s = STATE[state] ?? { label: state, tone: "border-line text-muted", mark: "○" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${s.tone}`}>
      <span aria-hidden>{s.mark}</span>{s.label}
    </span>
  );
}

/** Armed → Notice → Handover, with the current stage highlighted. */
export function Timeline({ state }: { state: string }) {
  const stage = ["NOTICE", "CLAIMABLE"].includes(state) ? 1 : state === "INHERITED" ? 2 : 0;
  const steps = ["Armed: your clock is running", "Notice: claim started, you can cancel", "Handover: heir can sign"];
  const dimmed = ["CANCELLED", "REVOKED", "BROKEN"].includes(state);
  return (
    <ol className={`grid gap-2 sm:grid-cols-3 ${dimmed ? "opacity-50" : ""}`} aria-label="Plan stages">
      {steps.map((label, i) => (
        <li key={label} aria-current={i === stage ? "step" : undefined}
          className={`rounded-lg border px-3 py-2 text-sm ${i === stage ? (i === 0 ? "border-accent bg-accent/5" : "border-danger bg-danger/5") : i < stage ? "border-line text-muted line-through" : "border-line text-muted"}`}>
          <span className="mr-1 font-mono text-xs">{i + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}

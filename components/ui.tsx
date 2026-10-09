"use client";

import { useEffect, useId, useState } from "react";

/* ---------- Buttons ---------- */

const base = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition-[background,color,border-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100";
export const btn = {
  primary: `${base} bg-green text-white hover:bg-green-strong`,
  secondary: `${base} border border-line bg-surface text-ink hover:border-ink/40`,
  danger: `${base} bg-oxblood text-white hover:brightness-110`,
  /** For night slabs. */
  light: `${base} bg-white text-night hover:bg-white/85`,
  ghostNight: `${base} border border-white/20 text-white hover:border-white/50`,
  link: "text-[15px] text-green underline decoration-green/30 underline-offset-4 hover:decoration-green",
};

type BtnVariant = keyof typeof btn;
export function Button({ variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return <button {...props} className={`${btn[variant]} ${className}`} />;
}

/* ---------- Formatting ---------- */

export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const fmtDate = (unix?: number) => (unix ? new Date(unix * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Re-renders every second; returns unix seconds. */
export function useNow(): number {
  // 0 until mounted: reading the clock during prerender is non-deterministic (Next 16 flags it).
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ---------- Surfaces ---------- */

/** Section-level rounded slab, inset from the window edge. `night` carries the dramatic sections. */
export function Slab({ children, className = "", tone = "surface", as: Tag = "section", ...rest }: {
  children: React.ReactNode; className?: string; tone?: "surface" | "night" | "tint" | "stone"; as?: "section" | "div" | "header" | "footer";
} & React.HTMLAttributes<HTMLElement>) {
  const tones = {
    surface: "bg-surface",
    night: "on-night bg-night text-white night-grid",
    tint: "bg-green-tint",
    stone: "bg-stone",
  };
  return <Tag {...rest} className={`slab ${tones[tone]} ${className}`}>{children}</Tag>;
}

export function Card({ children, className = "", tone = "plain" }: { children: React.ReactNode; className?: string; tone?: "plain" | "accent" | "danger" | "night" }) {
  const tones = {
    plain: "border-line bg-surface",
    accent: "border-green/40 bg-surface",
    danger: "border-oxblood/30 bg-oxblood-tint",
    night: "border-night-line bg-night-2 text-white",
  };
  return <section className={`rounded-[var(--radius-card)] border p-5 sm:p-6 ${tones[tone]} ${className}`}>{children}</section>;
}

export function PageHeader({ title, intro, aside }: { title: React.ReactNode; intro?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="headline text-[32px] sm:text-[44px]">{title}</h1>
        {intro && <p className="mt-3 text-[17px] leading-relaxed text-muted">{intro}</p>}
      </div>
      {aside}
    </div>
  );
}

/* ---------- Status ---------- */

export function LiveDot({ tone = "glow" }: { tone?: "glow" | "green" | "oxblood" | "muted" }) {
  const c = { glow: "bg-glow animate-livedot", green: "bg-green", oxblood: "bg-oxblood", muted: "bg-muted/50" }[tone];
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

/** Small mono status pill with a dot. Text carries the meaning; colour only reinforces it. */
export function Tag({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: "neutral" | "green" | "oxblood" | "night"; className?: string }) {
  const tones = {
    neutral: "border-line bg-surface text-muted",
    green: "border-green/30 bg-green-tint text-green",
    oxblood: "border-oxblood/30 bg-oxblood-tint text-oxblood",
    night: "border-white/15 bg-white/5 text-white/80",
  };
  const dot = { neutral: "muted", green: "green", oxblood: "oxblood", night: "glow" } as const;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[12px] tracking-tight ${tones[tone]} ${className}`}>
      <LiveDot tone={dot[tone]} />{children}
    </span>
  );
}

const STATE: Record<string, { label: string; tone: "neutral" | "green" | "oxblood" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  ARMED: { label: "Armed", tone: "green" },
  ELIGIBLE: { label: "Window passed", tone: "oxblood" },
  NOTICE: { label: "Claim started", tone: "oxblood" },
  CLAIMABLE: { label: "Handover possible", tone: "oxblood" },
  INHERITED: { label: "Handed over", tone: "green" },
  CANCELLED: { label: "Cancelled, re-arm needed", tone: "neutral" },
  REVOKED: { label: "Revoked", tone: "neutral" },
  BROKEN: { label: "Needs attention", tone: "oxblood" },
  SUPERSEDED: { label: "Replaced", tone: "neutral" },
};

export function StateBadge({ state, onNight = false }: { state: string; onNight?: boolean }) {
  const s = STATE[state] ?? { label: state, tone: "neutral" as const };
  return <Tag tone={onNight ? "night" : s.tone}>{s.label}</Tag>;
}

export function ErrorBox({ message, details }: { message?: string; details?: string[] }) {
  if (!message) return null;
  const extra = (details ?? []).filter((d) => d !== message);
  return (
    <div role="alert" className="rounded-[var(--radius-card)] border border-oxblood/30 bg-oxblood-tint p-4 text-[15px] text-oxblood">
      <p>{message}</p>
      {extra.length > 0 && <ul className="mt-2 list-disc pl-5">{extra.map((d) => <li key={d}>{d}</li>)}</ul>}
    </div>
  );
}

export function Status({ text }: { text?: string }) {
  return (
    <p aria-live="polite" className="flex min-h-5 items-center gap-2 text-[14px] text-muted">
      {text && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-green/25 border-t-green" />}
      {text ?? ""}
    </p>
  );
}

/* ---------- Time ---------- */

/** Arc + tabular digits. `total` is the whole window, so the arc shows how much is left. */
export function CountdownRing({ to, total, label, onNight = false, size = 168 }: { to?: number; total: number; label: string; onNight?: boolean; size?: number }) {
  const now = useNow();
  if (!to) return null;
  const left = now ? Math.max(0, to - now) : total;
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  const r = 44, c = 2 * Math.PI * r;
  const track = onNight ? "rgba(255,255,255,0.12)" : "var(--line)";
  const arc = onNight ? "var(--glow)" : "var(--green)";
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth="4" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={arc} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <div>
        <p className={`text-[14px] ${onNight ? "text-white/60" : "text-muted"}`}>{label}</p>
        <p className="mt-1 font-mono text-[34px] leading-none tracking-tight tabular-nums sm:text-[44px]">{!now ? "…" : left > 0 ? formatRemaining(left) : "Now"}</p>
        <p className={`mt-2 text-[14px] ${onNight ? "text-white/60" : "text-muted"}`}>{fmtDate(to)}</p>
      </div>
    </div>
  );
}

/** Compact countdown (no ring) used inside cards. */
export function Countdown({ to, label }: { to?: number; label: string }) {
  const now = useNow();
  if (!to) return null;
  const left = now ? to - now : 1;
  return (
    <div>
      <p className="text-[14px] text-muted">{label}</p>
      <p className="mt-1 font-mono text-[32px] leading-none tracking-tight tabular-nums sm:text-[40px]">{!now ? "…" : left > 0 ? formatRemaining(left) : "Now"}</p>
      <p className="mt-2 text-[14px] text-muted">{fmtDate(to)}</p>
    </div>
  );
}

/* ---------- Steps ---------- */

export function Stepper({ steps, current, onNight = false }: { steps: string[]; current: number; onNight?: boolean }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current, active = i === current;
        const cls = active
          ? onNight ? "bg-white text-night" : "bg-ink text-white"
          : done ? onNight ? "bg-white/10 text-white/80" : "bg-green-tint text-green" : onNight ? "text-white/45" : "text-muted";
        return (
          <li key={label} aria-current={active ? "step" : undefined} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[14px] ${cls}`}>
            <span className="font-mono text-[12px]">{done ? "✓" : i + 1}</span>{label}
          </li>
        );
      })}
    </ol>
  );
}

/** Plan stages Armed → Notice → Handover, current one highlighted. */
export function Timeline({ state, onNight = false }: { state: string; onNight?: boolean }) {
  const stage = ["NOTICE", "CLAIMABLE"].includes(state) ? 1 : state === "INHERITED" ? 2 : 0;
  const dimmed = ["CANCELLED", "REVOKED", "BROKEN"].includes(state);
  return (
    <div className={dimmed ? "opacity-50" : ""}>
      <Stepper onNight={onNight} steps={["Armed: clock running", "Notice: you can cancel", "Handover: heir can sign"]} current={stage} />
    </div>
  );
}

/* ---------- Forms ---------- */

export function Field({ label, hint, error, children, optional }: { label: string; hint?: React.ReactNode; error?: string | false; children: (id: string) => React.ReactNode; optional?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-[14px] font-medium">{label}{optional && <span className="font-normal text-muted"> (optional)</span>}</label>
      <div className="mt-1.5">{children(id)}</div>
      {error ? <p className="mt-1.5 text-[14px] text-oxblood">{error}</p> : hint ? <p className="mt-1.5 text-[14px] text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputCls = "w-full rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-muted/60 focus:border-green aria-[invalid=true]:border-oxblood";

/* ---------- App page container ---------- */

export function AppMain({ children, width = "wide" }: { children: React.ReactNode; width?: "wide" | "narrow" }) {
  return (
    <main className={`mx-auto w-full px-[var(--inset)] pb-6 pt-8 sm:pt-12 ${width === "wide" ? "max-w-6xl" : "max-w-3xl"}`}>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

/** Dark hero panel for app screens (status, inheritance). */
export function NightPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`on-night relative overflow-hidden rounded-[var(--radius-slab)] bg-night p-6 text-white night-grid sm:p-9 ${className}`}>{children}</section>;
}

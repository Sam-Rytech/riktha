"use client";

// The mechanism, drawn: the owner's quiet clock, two sealed pre-signed transactions, the grace period,
// and the key passing to the heir. Pure function of `t` (0..1) so the hero can loop it and the pinned
// story can drive it from scroll.

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

export const CAPTIONS: [number, string][] = [
  [0.15, "You use your account. The quiet clock runs."],
  [0.27, "You sent a payment. The clock starts over."],
  [0.5, "Silence again. The clock keeps running."],
  [0.56, "The window passed. The notice is submitted and you're alerted."],
  [0.8, "Grace period: one transaction from you cancels everything."],
  [0.9, "No reply. The handover runs on the Stellar network."],
  [1.01, "Your heir can now sign for the account."],
];
export const captionAt = (t: number) => CAPTIONS.find(([end]) => t < end)?.[1] ?? CAPTIONS[CAPTIONS.length - 1][1];

export interface SceneState {
  ring: number; pulse: number; reset: number; noticeOpen: boolean; noticeGlow: number;
  grace: number; handoverOpen: boolean; key: number; heir: boolean; fade: number;
}

export function sceneAt(t: number): SceneState {
  const ring = t < 0.18 ? 0.7 * ease(seg(t, 0, 0.18))
    : t < 0.23 ? 0.7 * (1 - ease(seg(t, 0.19, 0.23)))
      : t < 0.5 ? ease(seg(t, 0.23, 0.5)) : 1;
  return {
    ring,
    pulse: t > 0.14 && t < 0.2 ? seg(t, 0.14, 0.2) : -1,
    reset: t > 0.19 && t < 0.3 ? 1 - seg(t, 0.19, 0.3) : 0,
    noticeOpen: t >= 0.52,
    noticeGlow: seg(t, 0.5, 0.56) * (1 - seg(t, 0.62, 0.75)),
    grace: seg(t, 0.56, 0.8),
    handoverOpen: t >= 0.82,
    key: seg(t, 0.82, 0.9),
    heir: t >= 0.9,
    fade: t > 0.97 ? 1 - seg(t, 0.97, 1) : 1,
  };
}

const GLOW = "var(--glow)";
const OX = "#e0675f";

function Lock({ open, x, y }: { open: boolean; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <rect x="-6" y="-1" width="12" height="9" rx="2" fill="none" stroke={open ? GLOW : "rgba(255,255,255,0.55)"} strokeWidth="1.5" />
      <path d={open ? "M-3.5 -1 v-3 a3.5 3.5 0 0 1 7 0" : "M-3.5 -1 v-3 a3.5 3.5 0 0 1 7 0 v3"} fill="none" stroke={open ? GLOW : "rgba(255,255,255,0.55)"} strokeWidth="1.5"
        transform={open ? "translate(5 -2) rotate(18)" : ""} />
    </g>
  );
}

function SealCard({ x, y, title, cond, open, glow }: { x: number; y: number; title: string; cond: string; open: boolean; glow: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {glow > 0 && <rect x="-6" y="-6" width="112" height="62" rx="16" fill={GLOW} opacity={0.18 * glow} />}
      <rect width="100" height="50" rx="12" fill="rgba(255,255,255,0.04)" stroke={open ? GLOW : "rgba(255,255,255,0.22)"} strokeWidth="1.2" strokeDasharray={open ? "0" : "4 3"} />
      <Lock open={open} x={16} y={19} />
      <text x="30" y="21" fontSize="11.5" fontWeight="600" fill="#fff">{title}</text>
      <text x="12" y="39" fontSize="9" fill={open ? GLOW : "rgba(255,255,255,0.55)"}>{open ? "Accepted" : cond}</text>
    </g>
  );
}

function Node({ x, y, label, active, kind }: { x: number; y: number; label: string; active: boolean; kind: "owner" | "heir" }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {active && <circle r="40" fill={GLOW} opacity="0.16" />}
      <circle r="30" fill="#121b16" stroke={active ? GLOW : "rgba(255,255,255,0.22)"} strokeWidth="1.4" />
      {kind === "owner" ? (
        <g stroke="#fff" strokeWidth="1.6" fill="none" aria-hidden>
          <circle cx="0" cy="-5" r="6" /><path d="M-11 12 a11 9 0 0 1 22 0" />
        </g>
      ) : (
        <g stroke={active ? GLOW : "#fff"} strokeWidth="1.6" fill="none" aria-hidden>
          <circle cx="-4" cy="0" r="6" /><path d="M2 0 h11 M9 0 v5 M13 0 v4" />
        </g>
      )}
      <text y="50" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">{label}</text>
    </g>
  );
}

export default function ProtocolScene({ t, show = { ring: true, cards: true }, days = 180, graceDays = 30 }: {
  t: number; show?: { ring: boolean; cards: boolean }; days?: number; graceDays?: number;
}) {
  const s = sceneAt(t);
  const R = 42, C = 2 * Math.PI * R;
  const ringColor = s.ring >= 1 ? OX : GLOW;
  // Send pulse: owner (64,150) → ring (220,92), a gentle curve.
  const p = s.pulse >= 0 ? ease(s.pulse) : -1;
  const pulseX = 64 + (220 - 64) * p, pulseY = 150 - 58 * p - Math.sin(p * Math.PI) * 30;
  // Key: handover card (270,236) → heir (376,150).
  const k = ease(s.key);
  const keyX = 270 + (376 - 270) * k, keyY = 236 - (236 - 150) * k - Math.sin(k * Math.PI) * 24;

  return (
    <svg viewBox="0 0 440 330" className="h-auto w-full font-sans" role="img" aria-label={captionAt(t)} style={{ opacity: s.fade }}>
      <defs>
        <linearGradient id="link" x1="0" x2="1"><stop offset="0" stopColor="rgba(255,255,255,0.05)" /><stop offset="0.5" stopColor="rgba(255,255,255,0.25)" /><stop offset="1" stopColor="rgba(255,255,255,0.05)" /></linearGradient>
      </defs>

      {/* owner ↔ heir: named, but powerless until the end */}
      <path d="M94 150 H346" stroke="url(#link)" strokeWidth="1" strokeDasharray="2 5" />

      {show.ring && (
        <g transform="translate(220 92)">
          {s.reset > 0 && <circle r={R + 10 + 14 * (1 - s.reset)} fill="none" stroke={GLOW} strokeWidth="1" opacity={s.reset * 0.7} />}
          <circle r={R} fill="#0f1814" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <circle r={R} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - s.ring)} transform="rotate(-90)" />
          <text y="-2" textAnchor="middle" fontSize="20" fontWeight="600" fill="#fff" className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(days * s.ring)}d</text>
          <text y="14" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.55)">quiet of {days}</text>
        </g>
      )}

      <Node x={64} y={150} label="Your account" kind="owner" active={s.noticeOpen && !s.heir && s.noticeGlow > 0} />
      <Node x={376} y={150} label="Your heir" kind="heir" active={s.heir} />

      {p >= 0 && (
        <g>
          <circle cx={pulseX} cy={pulseY} r="9" fill={GLOW} opacity="0.2" />
          <circle cx={pulseX} cy={pulseY} r="4" fill={GLOW} />
        </g>
      )}

      {show.cards && (
        <g>
          <SealCard x={118} y={196} title="Notice" cond={`${days} days quiet`} open={s.noticeOpen} glow={s.noticeGlow} />
          <SealCard x={222} y={196} title="Handover" cond={`${graceDays} days later`} open={s.handoverOpen} glow={s.handoverOpen ? 1 - k : 0} />
          <g transform="translate(118 262)">
            <rect width="204" height="5" rx="2.5" fill="rgba(255,255,255,0.1)" />
            <rect width={204 * s.grace} height="5" rx="2.5" fill={OX} />
            <text y="20" fontSize="9" fill="rgba(255,255,255,0.55)">Grace period: {Math.round(graceDays * s.grace)} of {graceDays} days</text>
          </g>
        </g>
      )}

      {s.key > 0 && s.key < 1 && (
        <g transform={`translate(${keyX} ${keyY})`}>
          <circle r="11" fill={GLOW} opacity="0.2" />
          <g stroke={GLOW} strokeWidth="1.8" fill="none"><circle cx="-3" r="4" /><path d="M1 0 h7 M6 0 v3" /></g>
        </g>
      )}
    </svg>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { btn, CountdownRing, Slab, Tag } from "../ui";

const DEMO_CODE = "harbor violin maple ocean tiger lantern";
const WINDOW = 180; // demo seconds standing in for 180 days

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-stone shadow-[0_40px_80px_-40px_rgba(13,20,17,0.35)]">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-line" />)}</span>
        <span className="mx-auto truncate rounded-full bg-stone px-4 py-1 font-mono text-[12px] text-muted">{url}</span>
        <span className="w-10" aria-hidden />
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function OwnerDemo() {
  const [to, setTo] = useState<number>();
  useEffect(() => setTo(Math.floor(Date.now() / 1000) + 132), []);
  const [inbox, setInbox] = useState([
    { id: 1, title: "Your Riktha plan is armed", when: "Today" },
    { id: 0, title: "Check in: 50% of your window has passed", when: "Last month" },
  ]);
  const alive = () => {
    setTo(Math.floor(Date.now() / 1000) + WINDOW);
    setInbox((x) => [{ id: Date.now(), title: "Check-in recorded. Your clock starts over.", when: "Just now" }, ...x].slice(0, 4));
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div className="on-night rounded-2xl bg-night p-5 text-white night-grid">
        <div className="flex items-center justify-between"><p className="text-[15px] font-semibold">Your plan</p><Tag tone="night">Armed</Tag></div>
        <div className="mt-5 min-h-[120px]"><CountdownRing to={to} total={WINDOW} label="A claim can start in" onNight size={120} /></div>
        <p className="mt-4 text-[13px] text-white/55">Demo: seconds stand in for days.</p>
        <button onClick={alive} className={btn.light + " mt-4"}>I&apos;m alive</button>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-[15px] font-semibold">Notifications</p>
        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {inbox.map((n) => (
              <motion.li key={n.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="rounded-xl bg-stone px-3 py-2.5">
                <p className="text-[14px]">{n.title}</p>
                <p className="text-[12px] text-muted">{n.when}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

function HeirDemo() {
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"locked" | "scanning" | "open">("locked");
  const ok = code.trim().toLowerCase().replace(/\s+/g, " ") === DEMO_CODE;
  const unlock = () => { setPhase("scanning"); setTimeout(() => setPhase("open"), 1400); };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-[15px] font-semibold">An inheritance for you</p>
        <p className="mt-1 text-[14px] text-muted">Enter the six words the owner left you.</p>
        <input value={code} onChange={(e) => setCode(e.target.value)} disabled={phase !== "locked"} aria-label="Claim code"
          placeholder="six words" className="mt-4 w-full rounded-xl border border-line bg-stone px-3.5 py-3 font-mono text-[14px] outline-none focus:border-green" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DEMO_CODE.split(" ").map((w, i) => (
            <button key={w} type="button" disabled={phase !== "locked"} onClick={() => setCode(DEMO_CODE.split(" ").slice(0, i + 1).join(" "))}
              className="rounded-full border border-line px-2.5 py-1 font-mono text-[12px] text-muted hover:border-green hover:text-green">
              <span className="mr-1 opacity-50">{i + 1}</span>{w}
            </button>
          ))}
        </div>
        <button onClick={unlock} disabled={!ok || phase !== "locked"} className={btn.primary + " mt-4"}>Unlock</button>
        {phase === "locked" && !ok && <p className="mt-2 text-[12px] text-muted">Tip: tap the words in order.</p>}
      </div>
      <div className="on-night relative overflow-hidden rounded-2xl bg-night p-5 text-white night-grid">
        <div className="flex items-center justify-between"><p className="text-[15px] font-semibold">The estate</p><Tag tone="night">{phase === "open" ? "Handed over" : "Locked"}</Tag></div>
        {phase === "scanning" && <span aria-hidden className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-glow/30 to-transparent [animation:scan_1.4s_ease-in-out]" />}
        <ul className="mt-5 space-y-2">
          {[["XLM", "9,998.50"], ["RIK", "250.00"]].map(([c, a], i) => (
            <motion.li key={c} initial={false} animate={phase === "open" ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0.5, filter: "blur(5px)" }}
              transition={{ duration: 0.5, delay: phase === "open" ? 0.12 * i : 0 }} className="flex justify-between rounded-xl bg-white/5 px-4 py-3 font-mono text-[14px]">
              <span>{c}</span><span>{a}</span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-white/60">{phase === "open" ? "Send any of it to a wallet or an exchange. No crypto knowledge needed." : "Balances stay hidden until the handover."}</p>
        {phase === "open" && <button onClick={() => { setPhase("locked"); setCode(""); }} className={btn.ghostNight + " mt-4"}>Reset demo</button>}
      </div>
    </div>
  );
}

export default function LivePreview() {
  const [tab, setTab] = useState<"owner" | "heir">("owner");
  return (
    <Slab className="mt-[var(--inset)]" aria-labelledby="try-title">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <h2 id="try-title" className="headline text-[32px] sm:text-[48px]">Try both sides</h2>
            <p className="mt-3 text-[17px] leading-relaxed text-muted">A working preview with demo data. Press &ldquo;I&apos;m alive&rdquo; as the owner, or open the inheritance as the heir.</p>
          </div>
          <div role="tablist" aria-label="Preview" className="flex rounded-full border border-line bg-stone p-1">
            {(["owner", "heir"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${tab === k ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
                {k === "owner" ? "Owner view" : "Heir view"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10" role="tabpanel">
          <BrowserFrame url={tab === "owner" ? "riktha.vercel.app/dashboard" : "riktha.vercel.app/inherit"}>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                {tab === "owner" ? <OwnerDemo /> : <HeirDemo />}
              </motion.div>
            </AnimatePresence>
          </BrowserFrame>
        </div>
      </div>
    </Slab>
  );
}

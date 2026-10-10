"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { btn, Container, CountdownRing } from "../ui";

const DEMO_CODE = "harbor violin maple ocean tiger lantern";
const WINDOW = 180; // demo: seconds stand in for days

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="flex items-center justify-between gap-3"><p className="text-[17px] font-semibold tracking-[-0.01em]">{title}</p>{aside}</div>
      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function OwnerDemo() {
  const [to, setTo] = useState<number>();
  useEffect(() => setTo(Math.floor(Date.now() / 1000) + 132), []);
  const [inbox, setInbox] = useState([
    { id: 2, title: "Telegram linked", when: "Today" },
    { id: 1, title: "Your plan is armed", when: "Today" },
    { id: 0, title: "Email confirmed", when: "Today" },
  ]);
  const alive = () => {
    setTo(Math.floor(Date.now() / 1000) + WINDOW);
    setInbox((x) => [{ id: Date.now(), title: "Check-in recorded. The clock starts over.", when: "Just now" }, ...x].slice(0, 3));
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Your plan" aside={<span className="rounded-full bg-green-tint px-3 py-1 text-[13px] font-medium text-green">Armed</span>}>
        <div className="min-h-[140px]"><CountdownRing to={to} total={WINDOW} label="A claim can start in" size={120} /></div>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-6">
          <button onClick={alive} className={btn.primary}>I&apos;m alive</button>
          <p className="text-[14px] text-muted">In this demo, seconds stand in for days.</p>
        </div>
      </Panel>
      <Panel title="Notifications">
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {inbox.map((n) => (
              <motion.li key={n.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }} className="rounded-xl bg-stone px-4 py-3">
                <p className="text-[15px]">{n.title}</p>
                <p className="text-[13px] text-muted">{n.when}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Panel>
    </div>
  );
}

function HeirDemo() {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const ok = code.trim().toLowerCase().replace(/\s+/g, " ") === DEMO_CODE;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="An inheritance for you">
        <p className="text-[15px] text-muted">Enter the six words the owner left you. Tap them in order to try it.</p>
        <input value={code} onChange={(e) => setCode(e.target.value)} disabled={open} aria-label="Claim code" placeholder="six words"
          className="mt-4 w-full rounded-[var(--radius-field)] border border-line bg-stone px-4 py-3 font-mono text-[15px] outline-none focus:border-green" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DEMO_CODE.split(" ").map((w, i) => (
            <button key={w} type="button" disabled={open} onClick={() => setCode(DEMO_CODE.split(" ").slice(0, i + 1).join(" "))}
              className="rounded-full border border-line px-3 py-1 font-mono text-[13px] text-muted hover:border-green hover:text-green disabled:opacity-50">{w}</button>
          ))}
        </div>
        <div className="mt-auto pt-6">
          {open
            ? <button onClick={() => { setOpen(false); setCode(""); }} className={btn.secondary}>Reset demo</button>
            : <button onClick={() => setOpen(true)} disabled={!ok} className={btn.primary}>Unlock</button>}
        </div>
      </Panel>
      <Panel title="The estate" aside={<span className={`rounded-full px-3 py-1 text-[13px] font-medium ${open ? "bg-green-tint text-green" : "bg-stone text-muted"}`}>{open ? "Yours" : "Locked"}</span>}>
        <ul className="space-y-2">
          {[["XLM", "9,998.50"], ["RIK", "250.00"]].map(([c, a], i) => (
            <motion.li key={c} initial={false} animate={open ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0.55, filter: "blur(6px)" }}
              transition={{ duration: 0.5, delay: open ? 0.1 * i : 0 }} className="flex justify-between rounded-xl bg-stone px-4 py-3 font-mono text-[15px]">
              <span>{c}</span><span>{a}</span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-auto pt-6 text-[14px] text-muted">{open ? "Send any of it to a wallet or an exchange. No crypto knowledge needed." : "Balances stay hidden until the handover."}</p>
      </Panel>
    </div>
  );
}

export default function LivePreview() {
  const [tab, setTab] = useState<"owner" | "heir">("owner");
  return (
    <section aria-labelledby="try-title" className="border-t border-line">
      <Container className="py-16 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 id="try-title" className="headline text-[32px] sm:text-[44px]">Try both sides</h2>
            <p className="mt-4 text-[18px] leading-relaxed text-muted">A working preview with demo data: check in as the owner, or open the inheritance as the heir.</p>
          </div>
          <div role="tablist" aria-label="Preview" className="flex rounded-full border border-line bg-surface p-1">
            {(["owner", "heir"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`rounded-full px-5 py-2 text-[15px] font-medium transition-colors ${tab === k ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
                {k === "owner" ? "Owner" : "Heir"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10 rounded-[22px] border border-line bg-stone p-3 sm:p-4" role="tabpanel">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {tab === "owner" ? <OwnerDemo /> : <HeirDemo />}
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}

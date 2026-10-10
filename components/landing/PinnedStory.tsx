"use client";

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useRef, useState } from "react";
import { Slab } from "../ui";
import ProtocolScene, { captionAt } from "./ProtocolScene";
import { useLoop } from "./useLoop";

const STEPS = [
  { title: "Name your heir", body: "Pick who inherits: someone with a Stellar wallet, or anyone with an email address. Choose how long Riktha should wait: 90, 180 or 365 days." },
  { title: "Sign once", body: "One transaction pre-approves two future ones on your own account. Nothing moves, nothing is locked, and you keep full control." },
  { title: "Live normally", body: "Every transaction you send restarts the clock. There's no check-in ritual, and we remind you by email, Telegram and the dashboard." },
  { title: "If you go quiet", body: "A notice starts the claim and alerts you everywhere. One transaction cancels it. Stay silent through the grace period and your heir becomes a signer." },
];

/** Per step: which part of the scene is visible and which slice of its timeline plays. */
const SCENE = [
  { show: { ring: false, cards: false }, from: 0, to: 0, loop: false },
  { show: { ring: false, cards: true }, from: 0, to: 0, loop: false },
  { show: { ring: true, cards: true }, from: 0, to: 0.3, loop: true },
  { show: { ring: true, cards: true }, from: 0.3, to: 0.96, loop: false },
];

/** Tall section; a pinned panel advances through the steps as you scroll. */
export default function PinnedStory() {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))));

  const cfg = SCENE[step];
  const t = useLoop(sceneRef, step === 2 ? 5200 : 9000, { from: cfg.from, to: cfg.to, loop: cfg.loop, still: step === 3 ? 0.92 : cfg.from, enabled: cfg.to > cfg.from });

  return (
    <section ref={wrap} aria-labelledby="how-title" className={reduce ? "" : "relative h-[420vh]"}>
      <div className={reduce ? "" : "sticky top-0 flex h-[100svh] items-center py-[var(--inset)]"}>
        <Slab className="w-full">
          <div className="mx-auto grid max-w-6xl items-center gap-5 px-5 py-6 sm:gap-8 sm:px-10 sm:py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-14">
            <div>
              <h2 id="how-title" className="headline text-[28px] sm:text-[48px]">How it works</h2>
              {!reduce && <p className="mt-1 font-mono text-[13px] text-muted lg:hidden">Step {step + 1} of {STEPS.length}</p>}
              <ol className="mt-3 space-y-1.5 sm:mt-8">
                {STEPS.map((s, i) => (
                  <li key={s.title} aria-current={i === step ? "step" : undefined}
                    className={`rounded-2xl px-4 py-3 transition-colors duration-300 ${i === step ? "bg-green-tint" : reduce ? "" : "hidden lg:block"}`}>
                    <p className={`flex items-baseline gap-3 text-[17px] font-semibold tracking-[-0.01em] sm:text-[19px] ${i === step ? "text-ink" : "text-muted"}`}>
                      <span className="font-mono text-[13px] font-normal">{i + 1}</span>{s.title}
                    </p>
                    <AnimatePresence initial={false}>
                      {(i === step || reduce) && (
                        <motion.p key="b" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden pl-7 text-[15px] leading-relaxed text-muted sm:text-[16px]">
                          <span className="block pt-1.5">{s.body}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ol>
              {!reduce && (
                <div className="mt-6 flex gap-1.5 pl-4" aria-hidden>
                  {STEPS.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i === step ? "w-8 bg-ink" : "w-2 bg-line"}`} />)}
                </div>
              )}
            </div>
            <div ref={sceneRef} className="on-night mx-auto w-full max-w-[480px] rounded-[24px] bg-night p-4 text-white night-grid sm:p-7 lg:max-w-none">
              <ProtocolScene t={t} show={reduce ? { ring: true, cards: true } : cfg.show} />
              <p className="mt-3 min-h-[2.75rem] text-[14px] leading-snug text-white/75" aria-live="polite">
                {step < 2 && !reduce ? (step === 0 ? "Your heir is named, but has no power over your account." : "Two transactions are sealed on your account. The network refuses them until their time.") : captionAt(t)}
              </p>
            </div>
          </div>
        </Slab>
      </div>
    </section>
  );
}

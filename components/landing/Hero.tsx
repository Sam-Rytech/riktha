"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { btn, Container, formatRemaining, useNow } from "../ui";

const WINDOW = 180 * 86400;

/** A real slice of the owner dashboard: the thing people actually get. */
function HeroProduct() {
  const now = useNow();
  const [target, setTarget] = useState<number>();
  const [pulse, setPulse] = useState(0);
  useEffect(() => setTarget(Math.floor(Date.now() / 1000) + WINDOW - 37 * 86400 - 4 * 3600 - 1260), []);
  const left = target && now ? Math.max(0, target - now) : WINDOW;
  const pct = Math.round((left / WINDOW) * 100);

  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_30px_60px_-30px_rgba(13,20,17,0.25)]">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-line" />)}</span>
        <span className="mx-auto truncate font-mono text-[12px] text-muted">riktha.vercel.app/dashboard</span>
        <span className="w-[42px]" aria-hidden />
      </div>
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[15px] text-muted">Your plan</p>
          <span className="rounded-full bg-green-tint px-3 py-1 text-[13px] font-medium text-green">Armed</span>
        </div>
        <p className="mt-6 text-[15px] text-muted">A claim can start in</p>
        <motion.p key={pulse} initial={pulse ? { opacity: 0.4 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
          className="mt-1 text-[44px] font-semibold leading-none tracking-[-0.035em] tabular-nums sm:text-[60px]">
          {now ? formatRemaining(left) : "143d 19h 39m"}
        </motion.p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-stone" role="presentation">
          <div className="h-full rounded-full bg-green transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-6 divide-y divide-line border-y border-line text-[15px]">
          {[
            ["Heir", "Ada, by email (claim kit)"],
            ["After a claim starts", "30 days to cancel"],
            ["Alerts", "Email, Telegram, dashboard"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button onClick={() => { setTarget(Math.floor(Date.now() / 1000) + WINDOW); setPulse((p) => p + 1); }} className={btn.primary}>I&apos;m alive</button>
          <p className="text-[14px] text-muted">Any transaction you send resets the clock.</p>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const reduce = useReducedMotion();
  const fade = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d, ease: [0.22, 1, 0.36, 1] as const } });
  return (
    <section aria-labelledby="hero-title">
      <Container className="grid items-center gap-12 pb-16 pt-12 sm:pb-24 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <motion.h1 id="hero-title" {...fade(0)} className="display text-[44px] sm:text-[64px] lg:text-[72px]">
            Name an heir for your Stellar account.
          </motion.h1>
          <motion.p {...fade(0.08)} className="mt-6 max-w-[33rem] text-[18px] leading-relaxed text-muted sm:text-[20px]">
            Sign once. If you ever stop using your account, the Stellar network itself hands it to the person you chose,
            after a warning you can cancel with one click. No custodian, and no shared seed phrase.
          </motion.p>
          <motion.div {...fade(0.16)} className="mt-9 grid gap-3 sm:flex">
            <Link href="/plan/new" className={btn.primary + " w-full sm:w-auto"}>Create your plan</Link>
            <Link href="/claim" className={btn.secondary + " w-full sm:w-auto"}>I received a packet</Link>
          </motion.div>
          <motion.p {...fade(0.24)} className="mt-7 text-[15px] text-muted">
            <Link href="/evidence" className={btn.link}>Proven in 10 scenarios on Stellar testnet</Link>
          </motion.p>
        </div>
        <motion.div {...fade(0.2)}><HeroProduct /></motion.div>
      </Container>
    </section>
  );
}

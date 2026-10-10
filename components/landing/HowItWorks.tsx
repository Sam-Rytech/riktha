"use client";

import { motion, useReducedMotion } from "motion/react";
import { Container } from "../ui";

const STATIONS = [
  { title: "Sign once", body: "Pre-approve two future transactions on your own account. Nothing moves and nothing is locked." },
  { title: "Live normally", body: "Every transaction you send restarts the clock. We remind you well before it runs out." },
  { title: "Notice", body: "After your chosen window of silence, a claim starts and you're alerted by email, Telegram and the dashboard.", note: "Any transaction from you cancels it." },
  { title: "Handover", body: "If you stay silent through the grace period, your heir becomes a signer and can move the assets." },
];
const WHEN = ["Today", "Every day", "After 180 quiet days", "30 days later"];

/** One timeline; the bar fills once when it comes into view (the section's only motion). */
export default function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="how-title" className="border-t border-line">
      <Container className="py-16 sm:py-24">
        <h2 id="how-title" className="headline max-w-2xl text-[32px] sm:text-[44px]">How it works</h2>
        <p className="mt-4 max-w-2xl text-[18px] leading-relaxed text-muted">
          Two pre-signed transactions wait on your account. The Stellar network refuses them until their time comes.
        </p>

        <ol className="relative mt-14 grid gap-10 pl-8 lg:grid-cols-4 lg:gap-8 lg:pl-0">
          {/* the track: vertical on phones, horizontal on large screens */}
          <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-[2px] bg-line lg:bottom-auto lg:left-0 lg:right-0 lg:top-[5px] lg:h-[2px] lg:w-auto" />
          <motion.span aria-hidden initial={reduce ? false : { scaleX: 0, scaleY: 0 }} whileInView={{ scaleX: 1, scaleY: 1 }} viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-2 left-[5px] top-2 w-[2px] origin-top bg-green lg:bottom-auto lg:left-0 lg:right-0 lg:top-[5px] lg:h-[2px] lg:w-auto lg:origin-left" />
          {STATIONS.map((s, i) => (
            <li key={s.title} className="relative">
              <span aria-hidden className={`absolute -left-8 top-0 h-3 w-3 rounded-full border-2 lg:left-0 ${i === 3 ? "border-green bg-green" : "border-green bg-stone"}`} />
              <p className="font-mono text-[13px] text-muted lg:mt-8">{WHEN[i]}</p>
              <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.015em]">{s.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-muted">{s.body}</p>
              {s.note && <p className="mt-3 inline-block rounded-full bg-oxblood-tint px-3 py-1 text-[14px] font-medium text-oxblood">{s.note}</p>}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

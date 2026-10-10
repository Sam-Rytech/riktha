"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { btn, Slab, Tag } from "../ui";
import ProtocolScene, { captionAt } from "./ProtocolScene";
import { useLoop } from "./useLoop";

const rise = (i: number, reduce: boolean | null) => reduce ? {} : {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const },
};

export default function Hero() {
  const reduce = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const t = useLoop(sceneRef, 13000, { still: 0.92 });

  return (
    <Slab tone="night" className="relative mt-[var(--inset)] overflow-hidden">
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-36 pt-14 sm:px-10 sm:pb-48 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <motion.div {...rise(0, reduce)}><Tag tone="night">Live on Stellar testnet</Tag></motion.div>
          <motion.h1 {...rise(1, reduce)} className="display mt-6 text-[44px] sm:text-[64px] lg:text-[76px]">
            Your keys die with you.
            <span className="mt-2 block font-serif text-[0.92em] font-normal italic tracking-[-0.02em] text-glow">Your estate doesn&apos;t have to.</span>
          </motion.h1>
          <motion.p {...rise(2, reduce)} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-white/70 sm:text-[19px]">
            Sign once. If you ever stop using your Stellar account, the network itself hands it to the person you chose, after
            a warning you can cancel with one click.
          </motion.p>
          <motion.div {...rise(3, reduce)} className="mt-8 flex flex-wrap gap-3">
            <Link href="/plan/new" className={btn.light}>Create your plan</Link>
            <Link href="/claim" className={btn.ghostNight}>I received a packet</Link>
          </motion.div>
          <motion.ul {...rise(4, reduce)} className="mt-8 grid max-w-md grid-cols-3 gap-3 text-[13px] text-white/60">
            {["No custodian", "No shared seed phrase", "No smart contract to trust"].map((x) => (
              <li key={x} className="border-t border-white/15 pt-3">{x}</li>
            ))}
          </motion.ul>
        </div>

        <motion.div ref={sceneRef} initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }} className="relative">
          <div aria-hidden className="animate-breathe absolute inset-[8%] rounded-full bg-glow/25 blur-3xl" />
          <div className="relative rounded-[24px] border border-night-line bg-night-2/80 p-5 backdrop-blur sm:p-7">
            <div className="mb-3 flex items-center justify-between text-[12px] text-white/50">
              <span className="font-mono">riktha/plan</span>
              <span>Protocol view</span>
            </div>
            <ProtocolScene t={t} />
            <p className="mt-3 min-h-[2.75rem] text-[14px] leading-snug text-white/75" aria-hidden>{captionAt(t)}</p>
          </div>
        </motion.div>
      </div>

      <p aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-[0.18em] select-none text-center font-semibold leading-none tracking-[0.18em] text-white/[0.055] [font-size:clamp(84px,19vw,280px)]">
        RIKTHA
      </p>
    </Slab>
  );
}

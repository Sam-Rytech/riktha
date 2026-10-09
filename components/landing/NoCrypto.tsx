"use client";

import { motion, useReducedMotion } from "motion/react";
import { Slab } from "../ui";

const WORDS = ["harbor", "violin", "maple", "ocean", "tiger", "lantern"];

function Step({ n, title, body, children, i }: { n: number; title: string; body: string; children: React.ReactNode; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col">
      <div className="flex h-[210px] items-center justify-center rounded-[20px] bg-surface p-5">{children}</div>
      <p className="mt-5 flex items-baseline gap-3 text-[19px] font-semibold tracking-[-0.01em]"><span className="font-mono text-[13px] font-normal text-green">{n}</span>{title}</p>
      <p className="mt-1.5 pl-7 text-[15px] leading-relaxed text-muted">{body}</p>
    </motion.li>
  );
}

export default function NoCrypto() {
  return (
    <Slab tone="tint" className="mt-[var(--inset)]" aria-labelledby="nocrypto-title">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <div className="max-w-2xl">
          <h2 id="nocrypto-title" className="headline text-[32px] sm:text-[48px]">Your heir doesn&apos;t need to know crypto</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-muted">
            Name them by email. Your browser creates their key and locks it with six words that only you see. Riktha never
            holds a usable key, and your heir never needs a wallet.
          </p>
        </div>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
          <Step i={0} n={1} title="You keep six words with your will" body="Shown once, in your browser, with a print option. Riktha never sees them.">
            <div className="w-full max-w-[260px] rounded-xl border border-line p-4">
              <p className="text-[12px] text-muted">Claim code</p>
              <ol className="mt-2 grid grid-cols-2 gap-1.5">
                {WORDS.map((w, i) => <li key={w} className="rounded-lg bg-stone px-2.5 py-1.5 font-mono text-[13px]"><span className="mr-1.5 text-muted">{i + 1}</span>{w}</li>)}
              </ol>
            </div>
          </Step>
          <Step i={1} n={2} title="They get an email when it's time" body="A plain message with a link. Nothing to install, no account to create.">
            <div className="w-full max-w-[280px] rounded-xl border border-line p-4">
              <p className="text-[12px] text-muted">From Riktha</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug">You can claim the inheritance now</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Open your inheritance page and enter the six words the owner gave you.</p>
              <span className="mt-3 inline-block rounded-full bg-green px-3 py-1.5 text-[12px] font-medium text-white">Open your inheritance page</span>
            </div>
          </Step>
          <Step i={2} n={3} title="They claim and send it anywhere" body="To their bank's crypto account or any exchange, with the memo the exchange asks for.">
            <div className="w-full max-w-[260px] rounded-xl border border-line p-4">
              <p className="text-[12px] text-muted">Send funds</p>
              <div className="mt-2 rounded-lg bg-stone px-3 py-2 font-mono text-[12px] text-muted">GDQX…EXCH</div>
              <div className="mt-1.5 flex gap-1.5">
                <div className="flex-1 rounded-lg bg-stone px-3 py-2 font-mono text-[13px]">2,500 XLM</div>
                <div className="rounded-lg bg-stone px-3 py-2 font-mono text-[12px] text-muted">memo 4471</div>
              </div>
              <p className="mt-3 text-[13px] text-green">✓ Sent</p>
            </div>
          </Step>
        </ol>
      </div>
    </Slab>
  );
}

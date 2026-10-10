"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import evidence from "@/docs/evidence.json";
import { btn, Slab } from "../ui";

const GUARANTEES = [
  ["Riktha never holds a key", "The server stores only pre-signed transactions that the network refuses until their time comes."],
  ["Early claims are rejected", "Submit the handover a day early and validators turn it away. Nothing changes on your account."],
  ["One transaction cancels", "Anything you send after a notice uses the sequence number the handover needs. It can never run."],
  ["Your heir doesn't need us", "Their packet works with any Stellar tool, even if this site disappears."],
  ["Private until the end", "Before the handover the ledger shows two anonymous approvals. Your heir's address appears only at the end."],
  ["You keep your key", "Your own key is never removed. Before the handover your heir has no power at all."],
];

/** Light runs around the border of a card while it's in the middle of the screen. */
function Guarantee({ title, body }: { title: string; body: string }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-35% 0px -35% 0px" });
  return (
    <li ref={ref} style={{ ["--trace-opacity" as string]: inView ? 1 : 0 }}
      className="trace-border rounded-[var(--radius-card)] border border-night-line bg-night-2 p-6">
      <p className="text-[17px] font-semibold tracking-[-0.01em]">{title}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-white/60">{body}</p>
    </li>
  );
}

function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, reduce, to]);
  return <span ref={ref}>{n}</span>;
}

export default function DarkHalf() {
  const hashes = evidence.scenarios.flatMap((s) => s.txHashes.map((h) => ({ h, title: s.title })));
  const row = [...hashes, ...hashes];
  return (
    <Slab tone="night" className="mt-[var(--inset)] overflow-hidden" aria-labelledby="protocol-title">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <div className="max-w-2xl">
          <h2 id="protocol-title" className="headline text-[32px] sm:text-[48px]">Enforced by the protocol, not by us</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-white/65">
            Riktha uses transaction preconditions added to Stellar in Protocol 19. Every guarantee below holds even if Riktha
            is hacked or shut down.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map(([t, b]) => <Guarantee key={t} title={t} body={b} />)}
        </ul>

        <div className="mt-20 grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="font-mono text-[72px] leading-none tracking-tight text-glow sm:text-[104px]"><Counter to={evidence.passed} />/{evidence.total}</p>
            <p className="mt-3 text-[19px] font-semibold">scenarios proven on Stellar testnet</p>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/60">
              Early claims rejected, cancels made permanent, handovers completed, estates moved. Every result is a public transaction.
            </p>
            <Link href="/evidence" className={btn.light + " mt-6"}>See the evidence</Link>
          </div>
          <motion.pre initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6 }}
            className="overflow-x-auto rounded-[var(--radius-card)] border border-night-line bg-night-2 p-6 font-mono text-[13px] leading-relaxed text-white/80" aria-label="The two pre-signed transactions">
{`// signed once, valid later (CAP-21 preconditions)
notice = {
  seq:        s1,
  minSeqNum:  X,          // survives your normal activity
  minSeqAge:  180 days,   // only after you've gone quiet
  op:         BumpSequence()        // starts the claim
}
handover = {
  seq:        s1 + 1,     // any tx from you kills this forever
  minSeqAge:  30 days,
  op:         SetOptions(signer: heir)
}`}
          </motion.pre>
        </div>
      </div>

      <div className="border-t border-night-line py-5" aria-label="Recent evidence transactions">
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {row.map(({ h, title }, i) => (
            <a key={`${h}-${i}`} href={`https://stellar.expert/explorer/testnet/tx/${h}`} target="_blank" rel="noreferrer" tabIndex={i >= hashes.length ? -1 : 0}
              title={title} className="whitespace-nowrap rounded-full border border-night-line px-4 py-2 font-mono text-[12px] text-white/55 hover:border-glow hover:text-glow">
              {h.slice(0, 10)}…{h.slice(-6)}
            </a>
          ))}
        </div>
      </div>
    </Slab>
  );
}

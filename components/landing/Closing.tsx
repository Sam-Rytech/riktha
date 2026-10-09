import Link from "next/link";
import { btn, Slab } from "../ui";

const LIMITS = [
  ["It isn't a legal will.", "Your heir may still need probate. Riktha is the technical half that pairs with one."],
  ["Only sent transactions count.", "Receiving money doesn't reset the clock, and neither does an app that sends your signature through someone else's account."],
  ["Standard accounts only.", "Multisig accounts and smart wallets aren't supported yet."],
  ["Testnet only, and unaudited.", "Don't rely on it for real funds yet."],
];

const FAQ = [
  ["Can Riktha take my money?", "No. Riktha never holds a key that can move funds. The server only stores transactions that the Stellar network refuses until your windows have passed, and even then they can only add your chosen heir."],
  ["What if I'm just on a long holiday?", "Before anything happens you get reminders at 50%, 80% and 95% of your window, then an urgent alert when a claim starts. One transaction from you, or one tap on “I'm alive”, cancels it."],
  ["What does my heir need?", "Either their own Stellar wallet, or nothing at all: name them by email and give them the six-word claim code with your will."],
  ["What happens if Riktha shuts down?", "Your heir's packet holds both pre-signed transactions. They can submit them with any Stellar tool; our /claim page even works without our servers."],
  ["Does it cost anything?", "It's free while in testnet preview. Network fees are a fraction of a cent."],
];

const SOURCES = [
  ["Ledger Academy, summarising Chainalysis estimates of lost bitcoin", "https://ledger.com/academy/topics/economics-and-regulation/how-many-bitcoin-are-lost-ledger"],
  ["Cointelegraph, Stellar tokenized RWA market nears $4B", "https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth"],
  ["Spark, crypto estate planning solutions compared", "https://www.spark.money/tools/crypto-estate-planning-comparison"],
];

export function LimitsFaq() {
  return (
    <Slab className="mt-[var(--inset)]">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-2">
        <div>
          <h2 className="headline text-[32px] sm:text-[44px]">What it doesn&apos;t do</h2>
          <ul className="mt-8 space-y-5">
            {LIMITS.map(([t, d]) => (
              <li key={t} className="border-t border-line pt-5">
                <p className="text-[17px] font-semibold">{t}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="headline text-[32px] sm:text-[44px]">Questions</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pr-12 text-[15px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-line px-6 py-8 text-[13px] text-muted sm:px-10">
        <p className="font-medium text-ink">Sources</p>
        <ol className="mt-2 space-y-1">
          {SOURCES.map(([label, url], i) => (
            <li key={url} id={`source-${i + 1}`}><span className="font-mono">{i + 1}</span> <a href={url} className="underline decoration-line underline-offset-4 hover:text-ink">{label}</a></li>
          ))}
        </ol>
      </div>
    </Slab>
  );
}

export function FinalCta() {
  return (
    <Slab tone="night" className="relative mt-[var(--inset)] overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-6 pb-40 pt-20 text-center sm:px-10 sm:pb-56 sm:pt-28">
        <h2 className="display mx-auto max-w-3xl text-[40px] sm:text-[64px]">Sign once. Then get on with your life.</h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/65">It takes about two minutes and one signature. You can change or cancel it any time.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/plan/new" className={btn.light}>Create your plan</Link>
          <Link href="/evidence" className={btn.ghostNight}>See it proven on testnet</Link>
        </div>
      </div>
      <p aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-[0.18em] select-none text-center font-semibold leading-none tracking-[0.18em] text-white/[0.055] [font-size:clamp(84px,19vw,280px)]">RIKTHA</p>
    </Slab>
  );
}

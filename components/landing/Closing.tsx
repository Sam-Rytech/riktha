import Link from "next/link";
import { btn } from "../styles";
import { Container } from "../ui";

const LIMITS = [
  ["It isn't a legal will.", "Your heir may still need probate. Riktha is the technical half that pairs with one."],
  ["Only sent transactions count.", "Receiving money doesn't reset the clock, and neither does an app that sends your signature through someone else's account."],
  ["Standard accounts only.", "Multisig accounts and smart wallets aren't supported yet."],
  ["Testnet only, and unaudited.", "Don't rely on it for real funds yet."],
];

const FAQ = [
  ["Can Riktha take my money?", "No. Riktha never holds a key that can move funds. The server only stores transactions the network refuses until your windows have passed, and even then they can only add the heir you chose."],
  ["What if I'm just on a long holiday?", "You get reminders at 50%, 80% and 95% of your window, then an urgent alert if a claim starts. One transaction from you, or one tap on “I'm alive”, cancels it."],
  ["What does my heir need?", "Either their own Stellar wallet, or nothing at all: name them by email and keep the six-word claim code with your will."],
  ["What happens if Riktha shuts down?", "Your heir's packet holds both pre-signed transactions. They can submit them with any Stellar tool, and our claim page works without our servers."],
];

const SOURCES = [
  ["Ledger Academy, summarising Chainalysis estimates of lost bitcoin", "https://ledger.com/academy/topics/economics-and-regulation/how-many-bitcoin-are-lost-ledger"],
  ["Cointelegraph, Stellar tokenized RWA market nears $4B", "https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth"],
  ["Spark, crypto estate planning solutions compared", "https://www.spark.money/tools/crypto-estate-planning-comparison"],
];

export function LimitsFaq() {
  return (
    <section aria-label="Limits and questions" className="border-t border-line">
      <Container className="grid gap-14 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="headline text-[32px] sm:text-[44px]">What it doesn&apos;t do</h2>
          <ul className="mt-8 border-t border-line">
            {LIMITS.map(([t, d]) => (
              <li key={t} className="border-b border-line py-5">
                <p className="text-[17px] font-semibold">{t}</p>
                <p className="mt-1 text-[16px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="headline text-[32px] sm:text-[44px]">Questions</h2>
          <dl className="mt-8 border-t border-line">
            {FAQ.map(([q, a]) => (
              <div key={q} className="border-b border-line py-5">
                <dt className="text-[17px] font-semibold">{q}</dt>
                <dd className="mt-1 text-[16px] leading-relaxed text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="pb-4">
      <Container>
        <div className="rounded-[var(--radius-slab)] bg-green-tint p-8 sm:p-12 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:p-16">
          <div className="max-w-xl">
            <h2 id="cta-title" className="headline text-[32px] sm:text-[44px]">Set it up in two minutes.</h2>
            <p className="mt-4 text-[18px] leading-relaxed text-muted">One signature from your wallet. You can change or cancel it any time.</p>
          </div>
          <div className="mt-8 grid gap-3 sm:flex lg:mt-0 lg:shrink-0">
            <Link href="/plan/new" className={btn.primary + " w-full sm:w-auto"}>Create your plan</Link>
            <Link href="/evidence" className={btn.secondary + " w-full sm:w-auto"}>See the evidence</Link>
          </div>
        </div>
        <ol className="mt-12 space-y-1 text-[13px] text-muted">
          {SOURCES.map(([label, url], i) => (
            <li key={url} id={`source-${i + 1}`}><span className="mr-2 font-mono">{i + 1}</span><a href={url} className="underline decoration-line underline-offset-4 hover:text-ink">{label}</a></li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

import Link from "next/link";

const SOURCES = [
  { n: 1, label: "Ledger Academy, summarising Chainalysis estimates of lost bitcoin", url: "https://ledger.com/academy/topics/economics-and-regulation/how-many-bitcoin-are-lost-ledger" },
  { n: 2, label: "Cointelegraph, Stellar tokenized RWA market nears $4B", url: "https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth" },
  { n: 3, label: "Spark, crypto estate planning solutions compared", url: "https://www.spark.money/tools/crypto-estate-planning-comparison" },
  { n: 4, label: "CAP-21: generalized transaction preconditions", url: "https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md" },
];

function Ref({ n }: { n: number }) {
  return <sup><a href={`#source-${n}`} className="ml-0.5 text-accent no-underline hover:underline" aria-label={`Source ${n}`}>{n}</a></sup>;
}

/** The mechanism itself: a quiet clock, two sealed transactions, and the reset that undoes everything. */
function Mechanism() {
  const steps = [
    { title: "You send a transaction", note: "Any payment, trade or check-in. The clock starts here.", gap: "180 days of silence", mark: "bg-ink border-ink", tone: "" },
    { title: "Notice", note: "A pre-signed transaction anyone can submit. It starts the claim and alerts you on every channel.", gap: "30 days to respond", mark: "border-accent bg-surface", tone: "text-accent" },
    { title: "Handover", note: "A second pre-signed transaction adds your heir as a signer. They can now move the assets.", gap: null, mark: "border-danger bg-surface", tone: "text-danger" },
  ];
  return (
    <figure className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <figcaption className="mb-6 text-sm text-muted">What the Stellar network enforces once you sign</figcaption>
      <ol className="relative">
        {steps.map((st, i) => (
          <li key={st.title} className="relative grid grid-cols-[1.25rem_1fr] gap-x-4">
            <span aria-hidden className={`mt-1 h-4 w-4 rounded-full border-2 ${st.mark}`} />
            <div>
              <p className={`font-medium ${st.tone}`}>{st.title}</p>
              <p className="mt-0.5 text-sm text-muted">{st.note}</p>
            </div>
            {st.gap && (
              <>
                <span aria-hidden className="mx-auto my-2 h-12 w-px border-l-2 border-dashed border-line" />
                <p className="self-center text-sm italic text-muted">{st.gap}</p>
              </>
            )}
            {i === steps.length - 1 && <span className="sr-only">End of the sequence.</span>}
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-lg bg-accent/10 p-3 text-sm">
        <span className="font-medium text-accent">Send anything and it starts over.</span>{" "}
        Before the notice, your clock resets. After it, one transaction from you cancels the handover for good.
      </p>
    </figure>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="space-y-6">
          <h1 className="font-serif text-4xl leading-[1.1] sm:text-6xl">
            When you&apos;re gone, your Stellar account goes to the person you chose.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">
            You sign once. If you ever stop using your account, the Stellar network itself hands it to your heir,
            after a warning you can cancel with one click. No custodian. No shared seed phrase. No smart contract to trust.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/plan/new" className="rounded-full bg-accent px-6 py-3 font-medium text-paper hover:bg-accent-strong">Create your plan</Link>
            <Link href="/claim" className="rounded-full border border-line px-6 py-3 font-medium hover:border-muted">I received a packet</Link>
          </div>
          <p className="text-sm text-muted">Runs on Stellar testnet. Free while in preview.</p>
        </div>
        <Mechanism />
      </section>

      <section className="grid gap-8 border-t border-line py-16 lg:grid-cols-[1fr_2fr]">
        <h2 className="font-serif text-3xl">Keys die with their owners</h2>
        <div className="max-w-2xl space-y-4 text-lg leading-relaxed">
          <p>
            Nothing on a blockchain can tell &ldquo;the owner is gone&rdquo; from &ldquo;the owner is quiet&rdquo;. Between 2.3 and 3.7 million bitcoin,
            roughly a sixth of all that will ever exist, are estimated to be lost for good, mostly because their keys went unshared.<Ref n={1} />
          </p>
          <p>
            Stellar now holds real wealth: tokenized real-world assets on the network passed $3.9 billion in 2026.<Ref n={2} />{" "}
            Yet the inheritance tools that exist for Bitcoin and Ethereum don&apos;t cover Stellar at all.<Ref n={3} />{" "}
            Today a Stellar holder can share their seed phrase (and be robbed by a leak), write it into a will (and show it to every
            lawyer who reads it), or do nothing (and lose everything).
          </p>
        </div>
      </section>

      <section className="border-t border-line py-16">
        <h2 className="font-serif text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Name your heir", "Pick their Stellar account and how long Riktha should wait: 90, 180 or 365 days."],
            ["Sign once", "One transaction pre-approves two future ones on your account. Nothing moves; you keep full control."],
            ["Live normally", "Every transaction you send resets the clock. We remind you by email, Telegram and on your dashboard."],
            ["If you go quiet", "A notice starts the claim and alerts you. Stay silent through the grace period and your heir becomes a signer."],
          ].map(([t, d], i) => (
            <li key={t} className="border-t-2 border-ink pt-4">
              <p className="font-serif text-2xl text-muted">{i + 1}</p>
              <h3 className="mt-2 font-medium">{t}</h3>
              <p className="mt-1 text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 border-t border-line py-16 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-3">
          <h2 className="font-serif text-3xl">Enforced by the protocol, not by us</h2>
          <p className="text-muted">
            Riktha uses transaction preconditions added to Stellar in Protocol 19, whose specification describes exactly this
            kind of time-delayed key recovery.<Ref n={4} /> Every guarantee below holds even if Riktha is hacked or shut down.
          </p>
          <Link href="/evidence" className="inline-block text-accent underline underline-offset-4">See every claim proven on testnet</Link>
        </div>
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {[
            ["Riktha never holds a key", "The server stores only pre-signed transactions that the network refuses until their time comes."],
            ["Early claims are rejected", "Submit the handover a day early and validators turn it away. Nothing changes on your account."],
            ["One click cancels", "Any transaction you send after a notice uses up the sequence number the handover needs. It can never run."],
            ["Your heir doesn't need us", "They hold an inheritance packet and can claim with any Stellar tool, even if this site disappears."],
            ["Private until the end", "Before the handover, the ledger shows two anonymous approvals. Your heir's address appears only when they take over."],
            ["You keep your key", "Your own key is never removed. Before the handover your heir has no power at all."],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="font-medium">{t}</dt>
              <dd className="mt-1 text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-8 border-t border-line py-16 lg:grid-cols-[1fr_2fr]">
        <h2 className="font-serif text-3xl">What it doesn&apos;t do</h2>
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-muted marker:text-ink">
          <li><span className="text-ink">It isn&apos;t a legal will.</span> Your heir may still need probate. Riktha is the technical half that pairs with one.</li>
          <li><span className="text-ink">Only sent transactions count.</span> Receiving money doesn&apos;t reset the clock, and neither does an app that sends your signature through someone else&apos;s account.</li>
          <li><span className="text-ink">Standard accounts only.</span> Multisig accounts and smart wallets aren&apos;t supported yet.</li>
          <li><span className="text-ink">Your heir&apos;s key matters.</span> If they lose it, update your plan while you can.</li>
          <li><span className="text-ink">Testnet only and unaudited.</span> Don&apos;t rely on it for real funds yet.</li>
        </ul>
      </section>

      <section className="border-t border-line py-10 text-sm text-muted">
        <h2 className="font-medium text-ink">Sources</h2>
        <ol className="mt-2 space-y-1">
          {SOURCES.map((s) => (
            <li key={s.n} id={`source-${s.n}`}>{s.n}. <a href={s.url} className="underline underline-offset-4 hover:text-ink">{s.label}</a></li>
          ))}
        </ol>
      </section>
    </main>
  );
}

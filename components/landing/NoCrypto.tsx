import { Container } from "../ui";

const WORDS = ["harbor", "violin", "maple", "ocean", "tiger", "lantern"];

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-6 sm:max-lg:grid-cols-2 sm:max-lg:items-center sm:max-lg:gap-10">
      <div className="flex min-h-[220px] items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface p-6">{children}</div>
      <div>
        <p className="font-mono text-[13px] text-muted">Step {n}</p>
        <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.015em]">{title}</h3>
        <p className="mt-2 text-[16px] leading-relaxed text-muted">{body}</p>
      </div>
    </li>
  );
}

export default function NoCrypto() {
  return (
    <section aria-labelledby="nocrypto-title" className="border-t border-line">
      <Container className="py-16 sm:py-24">
        <h2 id="nocrypto-title" className="headline max-w-2xl text-[32px] sm:text-[44px]">Your heir doesn&apos;t need to know crypto</h2>
        <p className="mt-4 max-w-2xl text-[18px] leading-relaxed text-muted">
          Name them by email. Your browser creates their key and locks it with six words that only you see. Riktha never
          holds a usable key, and your heir never needs a wallet.
        </p>
        <ol className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-6">
          <Step n={1} title="You keep six words with your will" body="Shown once, in your browser, with a print option. Riktha never sees them.">
            <ol className="grid w-full max-w-[280px] grid-cols-2 gap-2">
              {WORDS.map((w, i) => <li key={w} className="rounded-lg bg-stone px-3 py-2 font-mono text-[14px]"><span className="mr-2 text-muted">{i + 1}</span>{w}</li>)}
            </ol>
          </Step>
          <Step n={2} title="They get an email when it's time" body="A plain message with a link. Nothing to install and no account to create.">
            <div className="w-full max-w-[290px]">
              <p className="text-[13px] text-muted">From Riktha</p>
              <p className="mt-1 text-[16px] font-semibold leading-snug">You can claim the inheritance now</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">Open your inheritance page and enter the six words the owner gave you.</p>
            </div>
          </Step>
          <Step n={3} title="They claim and send it anywhere" body="To any exchange or wallet, with the memo the exchange asks for.">
            <dl className="w-full max-w-[280px] space-y-2 text-[14px]">
              {[["To", "GDQX…EXCH"], ["Amount", "2,500 XLM"], ["Memo", "4471"]].map(([k, v]) => (
                <div key={k} className="flex justify-between rounded-lg bg-stone px-3 py-2"><dt className="text-muted">{k}</dt><dd className="font-mono">{v}</dd></div>
              ))}
              <p className="pt-1 text-green">✓ Sent</p>
            </dl>
          </Step>
        </ol>
      </Container>
    </section>
  );
}

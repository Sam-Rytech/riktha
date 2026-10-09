import type { Metadata } from "next";
import evidence from "@/docs/evidence.json";
import { NETWORKS } from "@/lib/core/config";

export const metadata: Metadata = {
  title: "Evidence · Riktha",
  description: "Every protocol claim Riktha makes, backed by a public Stellar testnet transaction.",
};

const explorer = NETWORKS.testnet.explorer;
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

export default function EvidencePage() {
  const e = evidence;
  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-12 sm:px-6">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl">{e.passed} of {e.total} scenarios pass on Stellar testnet</h1>
        <p className="max-w-2xl text-muted">
          Each scenario from the test plan was run against the live testnet with fresh accounts and
          {` ${e.windows.inactivitySeconds}-second`} windows. Every transaction is public; follow a link to see it on stellar.expert.
          Rejections are evidence too: they show the network itself refusing a claim that came too early or after the owner responded.
        </p>
        <p className="text-sm text-muted">Run {new Date(e.generatedAt).toUTCString()} · reproduce with <code className="font-mono">pnpm scenarios</code></p>
      </header>

      <ol className="space-y-4">
        {e.scenarios.map((s) => (
          <li key={s.id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-xl"><span className="mr-2 font-mono text-sm text-muted">S{s.id}</span>{s.title}</h2>
              <span className={`rounded-full border px-3 py-0.5 text-sm font-medium ${s.passed ? "border-accent text-accent" : "border-danger text-danger"}`}>
                {s.passed ? "✓ Pass" : "× Fail"}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted">Expected</dt><dd>{s.expected}</dd>
              <dt className="text-muted">Observed</dt><dd className="break-words">{s.observed}</dd>
              {s.txHashes.length > 0 && (<>
                <dt className="text-muted">Transactions</dt>
                <dd className="flex flex-wrap gap-x-4 gap-y-1">
                  {s.txHashes.map((h) => (
                    <a key={h} href={`${explorer}/tx/${h}`} target="_blank" rel="noreferrer" className="font-mono text-accent underline underline-offset-4">{short(h)}</a>
                  ))}
                </dd>
              </>)}
            </dl>
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-line p-5 text-sm">
        <h2 className="font-serif text-lg">Accounts used</h2>
        <ul className="mt-2 space-y-1">
          {Object.entries(e.accounts).map(([k, v]) => (
            <li key={k}><span className="text-muted">{k}: </span><a href={`${explorer}/account/${v}`} target="_blank" rel="noreferrer" className="break-all font-mono text-accent underline underline-offset-4">{v}</a></li>
          ))}
        </ul>
      </section>
    </main>
  );
}

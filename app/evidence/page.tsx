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
    <main className="mx-auto w-full max-w-6xl space-y-5 px-[var(--inset)] pb-6 pt-8 sm:pt-12">
      <section className="on-night rounded-[var(--radius-slab)] bg-night p-6 text-white night-grid sm:p-12">
        <p className="font-mono text-[72px] leading-none tracking-tight text-glow sm:text-[120px]">{e.passed}/{e.total}</p>
        <h1 className="headline mt-4 max-w-2xl text-[30px] sm:text-[48px]">scenarios proven on Stellar testnet</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/65">
          Each scenario from the test plan ran against the live testnet with fresh accounts and {e.windows.inactivitySeconds}-second windows.
          Rejections are evidence too: they show the network itself refusing a claim that came too early, or after the owner responded.
        </p>
        <p className="mt-6 text-[14px] text-white/50">
          Run on {new Date(e.generatedAt).toUTCString()}. Reproduce it with <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono">pnpm scenarios</code>.
        </p>
      </section>

      <ol className="grid gap-4 md:grid-cols-2">
        {e.scenarios.map((s) => (
          <li key={s.id} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.01em]"><span className="mr-2 font-mono text-[13px] font-normal text-muted">{s.id}</span>{s.title}</h2>
              <span className={`shrink-0 rounded-full px-3 py-1 font-mono text-[12px] ${s.passed ? "bg-green-tint text-green" : "bg-oxblood-tint text-oxblood"}`}>{s.passed ? "✓ pass" : "× fail"}</span>
            </div>
            <dl className="mt-4 space-y-3 text-[14px]">
              <div><dt className="text-muted">Expected</dt><dd className="mt-0.5">{s.expected}</dd></div>
              <div><dt className="text-muted">Observed</dt><dd className="mt-0.5 break-words">{s.observed}</dd></div>
            </dl>
            {s.txHashes.length > 0 && (
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {s.txHashes.map((h) => (
                  <a key={h} href={`${explorer}/tx/${h}`} target="_blank" rel="noreferrer"
                    className="rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-green hover:border-green">{short(h)}</a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <section className="rounded-[var(--radius-slab)] bg-surface p-6 sm:p-8">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Accounts used</h2>
        <ul className="mt-4 grid gap-2 text-[14px] md:grid-cols-2">
          {Object.entries(e.accounts).map(([k, v]) => (
            <li key={k} className="rounded-2xl bg-stone px-4 py-3">
              <p className="text-muted">{k}</p>
              <a href={`${explorer}/account/${v}`} target="_blank" rel="noreferrer" className="break-all font-mono text-[12px] text-green hover:underline">{v}</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

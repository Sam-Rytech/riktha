import type { Metadata } from "next";
import { Container } from "@/components/ui";
import evidence from "@/docs/evidence.json";
import { NETWORKS } from "@/lib/core/config";

export const metadata: Metadata = {
  title: "Evidence · Riktha",
  description: "Every protocol claim Riktha makes, backed by a public Stellar testnet transaction.",
};

const explorer = NETWORKS.testnet.explorer;

export default function EvidencePage() {
  const e = evidence;
  return (
    <main>
      <Container className="pb-6 pt-12 sm:pt-20">
        <h1 className="display max-w-3xl text-[40px] sm:text-[60px]">{e.passed} of {e.total} scenarios pass on Stellar testnet</h1>
        <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-muted">
          Each scenario from the test plan ran against the live testnet with fresh accounts and {e.windows.inactivitySeconds}-second
          windows. Rejections are evidence too: they show the network itself refusing a claim that came too early, or after the
          owner responded.
        </p>
        <p className="mt-4 text-[15px] text-muted">
          Run on {new Date(e.generatedAt).toUTCString()}. Reproduce it with <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[14px]">pnpm scenarios</code>.
        </p>

        <div className="mt-12 hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface md:block">
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="border-b border-line text-[13px] text-muted">
              <tr>
                <th className="px-5 py-4 font-normal">#</th>
                <th className="px-5 py-4 font-normal">Scenario</th>
                <th className="px-5 py-4 font-normal">Observed</th>
                <th className="px-5 py-4 font-normal">Result</th>
                <th className="px-5 py-4 font-normal">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {e.scenarios.map((s) => (
                <tr key={s.id} className="border-b border-line align-top last:border-b-0">
                  <td className="px-5 py-4 font-mono text-[13px] text-muted">{s.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{s.title}</p>
                    <p className="mt-1 text-[14px] text-muted">{s.expected}</p>
                  </td>
                  <td className="max-w-[300px] break-words px-5 py-4 text-[14px] text-muted">{s.observed}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-[13px] font-medium ${s.passed ? "bg-green-tint text-green" : "bg-oxblood-tint text-oxblood"}`}>{s.passed ? "Pass" : "Fail"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      {s.txHashes.length ? s.txHashes.map((h) => (
                        <a key={h} href={`${explorer}/tx/${h}`} target="_blank" rel="noreferrer" className="font-mono text-[13px] text-green underline decoration-green/30 underline-offset-4 hover:decoration-green">{h.slice(0, 10)}…</a>
                      )) : <span className="text-[13px] text-muted">Rejected, no transaction</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-10 space-y-3 md:hidden">
          {e.scenarios.map((s) => (
            <li key={s.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium"><span className="mr-2 font-mono text-[13px] text-muted">{s.id}</span>{s.title}</p>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-medium ${s.passed ? "bg-green-tint text-green" : "bg-oxblood-tint text-oxblood"}`}>{s.passed ? "Pass" : "Fail"}</span>
              </div>
              <p className="mt-2 text-[14px] text-muted">{s.expected}</p>
              <p className="mt-3 break-words border-t border-line pt-3 text-[13px] text-muted">{s.observed}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {s.txHashes.length ? s.txHashes.map((h) => (
                  <a key={h} href={`${explorer}/tx/${h}`} target="_blank" rel="noreferrer" className="font-mono text-[13px] text-green underline decoration-green/30 underline-offset-4">{h.slice(0, 10)}…</a>
                )) : <span className="text-[13px] text-muted">Rejected, no transaction</span>}
              </div>
            </li>
          ))}
        </ul>

        <h2 className="headline mt-16 text-[24px] sm:text-[28px]">Accounts used</h2>
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {Object.entries(e.accounts).map(([k, v]) => (
            <li key={k} className="rounded-[var(--radius-field)] border border-line bg-surface px-4 py-3 text-[14px]">
              <p className="text-muted">{k}</p>
              <a href={`${explorer}/account/${v}`} target="_blank" rel="noreferrer" className="break-all font-mono text-[12px] text-green hover:underline">{v}</a>
            </li>
          ))}
        </ul>
      </Container>
    </main>
  );
}

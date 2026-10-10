import Link from "next/link";
import evidence from "@/docs/evidence.json";
import { Container } from "../ui";

const GUARANTEES = [
  ["Riktha never holds a key", "The server stores only pre-signed transactions that the network refuses until their time comes."],
  ["Early claims are rejected", "Submit the handover a day early and validators turn it away. Nothing changes on your account."],
  ["One transaction cancels", "Anything you send after a notice uses up the sequence number the handover needs. It can never run."],
  ["Your heir doesn't need us", "Their packet works with any Stellar tool, even if this site disappears."],
  ["Private until the end", "Before the handover, the ledger shows two anonymous approvals. Your heir's address appears only at the end."],
  ["You keep your key", "Your own key is never removed. Before the handover your heir has no power at all."],
];

/** Representative rows; the full set lives on /evidence. */
const ROWS: [number, string][] = [[2, "Rejected by the network"], [6, "Cancelled for good"], [8, "Heir became a signer"], [9, "Assets moved by the heir"]];

/** The page's single dark moment: flat ink, no texture, no glow. */
export default function Protocol() {
  const byId = new Map(evidence.scenarios.map((s) => [s.id, s]));
  return (
    <section aria-labelledby="protocol-title" className="border-t border-line py-16 sm:py-24">
      <Container>
        <div className="on-night rounded-[var(--radius-slab)] bg-night p-8 text-white sm:p-12 lg:p-16">
          <h2 id="protocol-title" className="headline max-w-2xl text-[32px] sm:text-[44px]">Enforced by the protocol, not by us</h2>
          <p className="mt-4 max-w-2xl text-[18px] leading-relaxed text-white/65">
            Riktha uses transaction preconditions added to Stellar in Protocol 19. Every guarantee below holds even if Riktha
            is hacked or shut down.
          </p>

          <dl className="mt-12 grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {GUARANTEES.map(([t, b], i) => (
              <div key={t} className={`border-b border-white/10 py-7 sm:pr-8 ${i % 3 !== 2 ? "lg:border-r lg:border-white/10" : ""} ${i % 3 !== 0 ? "lg:pl-8" : ""} ${i % 2 === 1 ? "sm:max-lg:pl-8" : "sm:max-lg:border-r sm:max-lg:border-white/10"}`}>
                <dt className="text-[17px] font-semibold tracking-[-0.01em]">{t}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-white/60">{b}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <div>
              <h3 className="text-[20px] font-semibold tracking-[-0.015em]">{evidence.passed} of {evidence.total} scenarios pass on testnet</h3>
              <table className="mt-5 hidden w-full text-left text-[15px] sm:table">
                <thead className="text-[13px] text-white/50">
                  <tr><th className="pb-3 font-normal">Scenario</th><th className="pb-3 font-normal">Result</th><th className="pb-3 text-right font-normal">Proof</th></tr>
                </thead>
                <tbody>
                  {ROWS.map(([id, result]) => {
                    const s = byId.get(id)!;
                    const hash = s.txHashes[s.txHashes.length - 1];
                    return (
                      <tr key={id} className="border-t border-white/10 align-top">
                        <td className="py-3 pr-4">{s.title}</td>
                        <td className="py-3 pr-4 text-white/70">{result}</td>
                        <td className="py-3 text-right font-mono text-[13px]">
                          {hash
                            ? <a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} target="_blank" rel="noreferrer" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">{hash.slice(0, 6)}…</a>
                            : <span className="text-white/50">rejected</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="mt-5 border-t border-white/10 sm:hidden">
                {ROWS.map(([id, result]) => {
                  const s = byId.get(id)!;
                  const hash = s.txHashes[s.txHashes.length - 1];
                  return (
                    <li key={id} className="border-b border-white/10 py-4">
                      <p className="text-[15px]">{s.title}</p>
                      <p className="mt-1 flex justify-between gap-4 text-[14px] text-white/65">
                        <span>{result}</span>
                        {hash
                          ? <a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} target="_blank" rel="noreferrer" className="font-mono text-[13px] text-white underline decoration-white/30 underline-offset-4">{hash.slice(0, 6)}…</a>
                          : <span className="font-mono text-[13px] text-white/50">rejected</span>}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <Link href="/evidence" className="mt-6 inline-block text-[15px] text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">See all {evidence.total} scenarios</Link>
            </div>
            <pre className="hidden overflow-x-auto rounded-[var(--radius-card)] sm:block border border-white/10 p-6 font-mono text-[13px] leading-relaxed text-white/75" aria-label="The two pre-signed transactions">
{`// signed once, valid later (CAP-21)
notice = {
  seq:        s1,
  minSeqNum:  X,         // survives normal use
  minSeqAge:  180 days,  // only after silence
  op:         BumpSequence()
}
handover = {
  seq:        s1 + 1,    // any tx from you kills it
  minSeqAge:  30 days,
  op:         SetOptions(signer: heir)
}`}
            </pre>
          </div>
        </div>
      </Container>
    </section>
  );
}

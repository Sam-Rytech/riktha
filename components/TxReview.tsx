import type { ExplainedTx } from "@/lib/core/explain";

/** Plain-language summary with the exact operations and conditions behind a disclosure (PRD §9). */
export default function TxReview({ title, summary, tx, badge }: { title: string; summary: string; tx: ExplainedTx; badge?: string }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
        {badge && <span className="rounded-full bg-stone px-3 py-1 font-mono text-[12px] text-muted">{badge}</span>}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{summary}</p>
      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-medium text-green [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">›</span>What exactly will be signed?
        </summary>
        <div className="mt-4 space-y-4 rounded-2xl bg-stone p-4 text-[14px]">
          <ol className="space-y-3">
            {tx.ops.map((op, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                <span className="font-mono text-[12px] text-muted">{i + 1}</span>
                <div>
                  <p>{op.plain}</p>
                  <code className="mt-1 block break-all font-mono text-[12px] text-muted">{op.technical}</code>
                </div>
              </li>
            ))}
          </ol>
          {tx.conditions.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="font-medium">Conditions the Stellar network enforces</p>
              <ul className="mt-1.5 space-y-1 text-muted">
                {tx.conditions.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
          <p className="whitespace-pre-line break-all border-t border-line pt-3 font-mono text-[12px] text-muted">
            source {tx.source}{"\n"}sequence {tx.sequence}{tx.memo ? `\nmemo "${tx.memo}"` : ""}
          </p>
        </div>
      </details>
    </section>
  );
}

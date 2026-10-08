import type { ExplainedTx } from "@/lib/core/explain";

/** Plain-language summary with the exact operations and conditions behind a disclosure (PRD §9). */
export default function TxReview({ title, summary, tx, badge }: { title: string; summary: string; tx: ExplainedTx; badge?: string }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg">{title}</h3>
        {badge && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{badge}</span>}
      </div>
      <p className="mt-2 text-muted">{summary}</p>
      <details className="group mt-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-accent underline-offset-4 hover:underline">
          What exactly will be signed?
        </summary>
        <div className="mt-3 space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            {tx.ops.map((op, i) => (
              <li key={i}>
                <p>{op.plain}</p>
                <code className="mt-0.5 block break-all font-mono text-xs text-muted">{op.technical}</code>
              </li>
            ))}
          </ol>
          {tx.conditions.length > 0 && (
            <div>
              <p className="font-medium">Conditions enforced by the Stellar network</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {tx.conditions.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
          <p className="font-mono text-xs text-muted">
            source {tx.source} · sequence {tx.sequence}{tx.memo ? ` · memo "${tx.memo}"` : ""}
          </p>
        </div>
      </details>
    </section>
  );
}

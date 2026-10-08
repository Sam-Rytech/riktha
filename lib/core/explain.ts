import { Transaction } from "@stellar/stellar-sdk";
import { memoText } from "./builders";
import { formatDuration } from "./eligibility";

export interface ExplainedOp { plain: string; technical: string }
export interface ExplainedTx {
  source: string;
  sequence: string;
  memo?: string;
  conditions: string[];
  ops: ExplainedOp[];
}

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

/** Plain-language view of a transaction for the "What exactly will be signed?" panels. */
export function explainTx(tx: Transaction, names: Record<string, string> = {}): ExplainedTx {
  const who = (addr?: string) => (addr ? names[addr] ?? short(addr) : names[tx.source] ?? short(tx.source));
  const conditions: string[] = [];
  if (tx.minAccountSequence !== undefined) conditions.push(`Only valid while the account's sequence is at least ${tx.minAccountSequence}.`);
  else if (tx.minAccountSequenceAge !== undefined) conditions.push(`Only valid if the account's sequence is exactly ${BigInt(tx.sequence) - 1n}.`);
  if (tx.minAccountSequenceAge) conditions.push(`Only valid after ${who()} has sent nothing for ${formatDuration(Number(tx.minAccountSequenceAge))}.`);
  if (!tx.timeBounds || tx.timeBounds.maxTime === "0") conditions.push("Never expires.");

  const ops = tx.operations.map((op): ExplainedOp => {
    const src = who(op.source);
    switch (op.type) {
      case "bumpSequence":
        return { plain: `Record activity on ${src} (changes nothing else).`, technical: `BumpSequence(bumpTo=${op.bumpTo})` };
      case "setOptions": {
        const s = op.signer as { ed25519PublicKey?: string; preAuthTx?: Buffer; weight?: number } | undefined;
        if (s?.preAuthTx) {
          const h = Buffer.from(s.preAuthTx).toString("hex");
          return s.weight
            ? { plain: `Pre-approve one exact future transaction (${short(h)}) on ${src}.`, technical: `SetOptions(signer=preAuthTx:${h}, weight=${s.weight})` }
            : { plain: `Remove the pre-approval for transaction ${short(h)} from ${src}.`, technical: `SetOptions(signer=preAuthTx:${h}, weight=0)` };
        }
        if (s?.ed25519PublicKey) {
          return s.weight
            ? { plain: `Give ${who(s.ed25519PublicKey)} full control of ${src}.`, technical: `SetOptions(signer=${s.ed25519PublicKey}, weight=${s.weight})` }
            : { plain: `Remove ${who(s.ed25519PublicKey)} as a signer of ${src}.`, technical: `SetOptions(signer=${s.ed25519PublicKey}, weight=0)` };
        }
        return { plain: `Change settings on ${src}.`, technical: "SetOptions" };
      }
      case "beginSponsoringFutureReserves":
        return { plain: `${src} pays the small XLM reserve for what follows.`, technical: `BeginSponsoringFutureReserves(sponsored=${op.sponsoredId})` };
      case "endSponsoringFutureReserves":
        return { plain: "End of the reserve sponsorship.", technical: "EndSponsoringFutureReserves" };
      case "payment":
        return {
          plain: `Send ${op.amount} ${op.asset.isNative() ? "XLM" : op.asset.getCode()} from ${src} to ${who(op.destination)}.`,
          technical: `Payment(${op.amount} ${op.asset.toString()} → ${op.destination})`,
        };
      case "changeTrust":
        return { plain: `${src} agrees to hold this asset.`, technical: `ChangeTrust(${String(op.line)})` };
      default:
        return { plain: `${op.type} on ${src}.`, technical: op.type };
    }
  });

  return { source: tx.source, sequence: tx.sequence, memo: memoText(tx), conditions, ops };
}

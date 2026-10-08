/** Horizon `extras.result_codes` (a fee-bump adds `inner_transaction`). */
export interface ResultCodes {
  transaction?: string;
  inner_transaction?: string;
  operations?: string[];
}

export type SubmitErrorKind =
  | "NOT_YET"            // minSeqAge not reached
  | "CANCELLED"          // sequence moved on: the owner acted, or the phase was already used
  | "ALREADY_USED"       // pre-auth signer gone (phase already executed or plan revoked)
  | "FEE"                // fee source can't pay / fee too low
  | "NO_TRUST"           // destination lacks a trustline
  | "UNDERFUNDED"        // not enough balance
  | "LOW_RESERVE"        // account would drop below its minimum balance
  | "EXPIRED"            // timebounds passed
  | "UNKNOWN";

export interface MappedError { kind: SubmitErrorKind; message: string; codes: ResultCodes }

/** Pull result codes out of a Horizon submit error (SDK error objects or raw JSON). */
export function extractResultCodes(e: unknown): ResultCodes {
  const anyE = e as { response?: { data?: { extras?: { result_codes?: ResultCodes } } }; extras?: { result_codes?: ResultCodes } };
  return anyE?.response?.data?.extras?.result_codes ?? anyE?.extras?.result_codes ?? {};
}

export function mapSubmitError(codes: ResultCodes, ctx: { availableFrom?: Date } = {}): MappedError {
  const tx = codes.transaction === "tx_fee_bump_inner_failed" ? codes.inner_transaction : codes.transaction;
  const ops = codes.operations ?? [];
  const when = ctx.availableFrom ? ` Available from ${ctx.availableFrom.toLocaleString()}.` : "";
  const m = (kind: SubmitErrorKind, message: string): MappedError => ({ kind, message, codes });

  switch (tx) {
    case "tx_bad_minseq_age_or_gap":
      return m("NOT_YET", `Not yet: the waiting period hasn't passed.${when}`);
    case "tx_bad_seq":
      return m("CANCELLED", "This step is no longer possible: the owner has used their account since, so the claim was cancelled.");
    case "tx_bad_auth":
      return m("ALREADY_USED", "This step was already used or the plan was revoked.");
    case "tx_insufficient_fee":
      return m("FEE", "The network fee was too low. Try again.");
    case "tx_insufficient_balance":
      return m("FEE", "The account paying the fee doesn't have enough XLM.");
    case "tx_too_late":
      return m("EXPIRED", "This transaction expired. Start again.");
  }
  if (codes.transaction === "tx_insufficient_balance" || codes.transaction === "tx_insufficient_fee") {
    return m("FEE", "The account paying the fee doesn't have enough XLM.");
  }
  if (ops.includes("op_no_trust")) return m("NO_TRUST", "The receiving account must trust this asset first.");
  if (ops.includes("op_underfunded")) return m("UNDERFUNDED", "Not enough balance to send that amount.");
  if (ops.includes("op_low_reserve")) return m("LOW_RESERVE", "The account needs more XLM to cover its minimum balance.");
  return m("UNKNOWN", `The network rejected the transaction (${[codes.transaction, codes.inner_transaction, ...ops].filter(Boolean).join(", ") || "no details"}).`);
}

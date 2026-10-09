"use client";

// Browser-side transaction flows. All user transactions are signed in Freighter and sent straight to Horizon.
import { Asset, FeeBumpTransaction, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildCheckIn, buildEstateTransfer, parseTx, wrapFeeBump } from "@/lib/core/builders";
import { NETWORKS, type NetworkName } from "@/lib/core/config";
import type { SubmitErrorKind } from "@/lib/core/errors";
import { loadAccountRaw, submit } from "@/lib/stellar/horizon";
import { signXdr } from "@/lib/wallet/freighter";

export class TxError extends Error {
  constructor(message: string, readonly kind: SubmitErrorKind | "WALLET") { super(message); }
}

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as NetworkName;

async function send(tx: Parameters<typeof submit>[1], ctx?: { availableFrom?: Date }): Promise<string> {
  const res = await submit(NETWORK, tx, ctx);
  if (!res.ok) throw new TxError(res.error.message, res.error.kind);
  return res.hash;
}

async function currentSeq(address: string): Promise<bigint> {
  const a = await loadAccountRaw(NETWORK, address);
  if (!a) throw new TxError("This account doesn't exist on the network.", "UNKNOWN");
  return BigInt(a.sequence);
}

async function sign(tx: Transaction, address: string): Promise<Transaction> {
  return parseTx(NETWORK, await signXdr(tx.toXDR(), NETWORK, address));
}

/** Signs and submits any owner transaction XDR (setup, revoke). */
export async function signAndSubmit(xdr: string, address: string): Promise<string> {
  return send(await sign(parseTx(NETWORK, xdr), address));
}

/** "I'm alive" / "Cancel the claim": any sent transaction resets the clock and kills a pending handover. */
export async function checkIn(owner: string): Promise<string> {
  return send(await sign(buildCheckIn(NETWORK, owner, await currentSeq(owner)), owner));
}

/**
 * Submits a pre-authorized phase. With `feeSource` it is wrapped in a fee-bump that account signs (SP7);
 * without, the owner's account pays the tiny fee itself (SP5b) and no wallet is needed.
 * `innerSigner` is only needed for the sponsored Phase 2 variant.
 */
export async function submitPhase(
  phaseXdr: string, opts: { feeSource?: string; innerSigner?: string; availableFrom?: Date } = {},
): Promise<string> {
  let inner = parseTx(NETWORK, phaseXdr);
  if (opts.innerSigner) inner = await sign(inner, opts.innerSigner);
  if (!opts.feeSource) return send(inner, opts);
  const fbXdr = await signXdr(wrapFeeBump(NETWORK, opts.feeSource, inner).toXDR(), NETWORK, opts.feeSource);
  return send(TransactionBuilder.fromXDR(fbXdr, NETWORKS[NETWORK].passphrase) as FeeBumpTransaction, opts);
}

/** After handover: the heir signs once; the payment's source is the owner's account. */
export async function estateTransfer(
  heir: string, owner: string, asset: Asset, amount: string, addTrustline: boolean,
): Promise<string> {
  const tx = buildEstateTransfer(NETWORK, heir, await currentSeq(heir), owner, asset, amount, heir, { addTrustline });
  return send(await sign(tx, heir));
}

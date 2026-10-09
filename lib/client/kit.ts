"use client";

// Claim-kit heir actions (A§15): the heir key lives only in memory, unlocked with the claim code.
import { Asset, Keypair } from "@stellar/stellar-sdk";
import { buildInheritedPayment } from "@/lib/core/builders";
import { loadAccountRaw, submit } from "@/lib/stellar/horizon";
import { NETWORK, TxError } from "./actions";

const MIN_NEW_ACCOUNT_XLM = 1;

/** Sends from the inherited (owner's) account; the heir key signs, the account pays its own fee. */
export async function inheritedSend(
  heir: Keypair, owner: string, destination: string, asset: Asset, amount: string, memo?: string,
): Promise<string> {
  const [ownerAcc, destAcc] = await Promise.all([loadAccountRaw(NETWORK, owner), loadAccountRaw(NETWORK, destination)]);
  if (!ownerAcc) throw new TxError("The inherited account no longer exists.", "UNKNOWN");
  const createDestination = !destAcc;
  if (createDestination && !asset.isNative()) throw new TxError("That address doesn't exist yet. Send XLM to it first, or use an address that already exists.", "NO_TRUST");
  if (createDestination && Number(amount) < MIN_NEW_ACCOUNT_XLM) throw new TxError(`That address is new on Stellar: send at least ${MIN_NEW_ACCOUNT_XLM} XLM to open it.`, "UNDERFUNDED");
  const tx = buildInheritedPayment(NETWORK, owner, BigInt(ownerAcc.sequence), destination, asset, amount, { memo: memo || undefined, createDestination });
  tx.sign(heir);
  const res = await submit(NETWORK, tx);
  if (!res.ok) throw new TxError(res.error.message, res.error.kind);
  return res.hash;
}


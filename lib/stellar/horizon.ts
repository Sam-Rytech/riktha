// Isomorphic Horizon access (browser + server). Reads raw JSON so `sequence_time` etc. are kept.
import { FeeBumpTransaction, Horizon, Transaction } from "@stellar/stellar-sdk";
import { NETWORKS, NetworkName } from "@/lib/core/config";
import { extractResultCodes, mapSubmitError, MappedError } from "@/lib/core/errors";
import type { HorizonAccount } from "@/lib/core/state";

const servers = new Map<NetworkName, Horizon.Server>();
export function horizon(network: NetworkName): Horizon.Server {
  let s = servers.get(network);
  if (!s) servers.set(network, (s = new Horizon.Server(NETWORKS[network].horizon)));
  return s;
}

/** Raw account record, or null if the account doesn't exist. */
export async function loadAccountRaw(network: NetworkName, address: string): Promise<HorizonAccount | null> {
  const res = await fetch(`${NETWORKS[network].horizon}/accounts/${address}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Horizon ${res.status} loading ${address}`);
  return (await res.json()) as HorizonAccount;
}

/** Base reserve from the latest ledger (never hardcoded, A§2.8). */
export async function baseReserveStroops(network: NetworkName): Promise<bigint> {
  const res = await fetch(`${NETWORKS[network].horizon}/ledgers?order=desc&limit=1`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Horizon ${res.status} loading latest ledger`);
  const json = (await res.json()) as { _embedded: { records: { base_reserve_in_stroops: number }[] } };
  return BigInt(json._embedded.records[0].base_reserve_in_stroops);
}

export interface TxResultRecord { successful: boolean; source_account: string; created_at: string }

/** Transaction record by hash, or null if Horizon doesn't know it (yet). */
export async function loadTransaction(network: NetworkName, hash: string): Promise<TxResultRecord | null> {
  const res = await fetch(`${NETWORKS[network].horizon}/transactions/${hash}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Horizon ${res.status} loading tx ${hash}`);
  return (await res.json()) as TxResultRecord;
}

export type SubmitResult = { ok: true; hash: string } | { ok: false; error: MappedError };

/** Submit and map failures to user-facing messages; never throws for network rejections. */
export async function submit(
  network: NetworkName, tx: Transaction | FeeBumpTransaction, ctx: { availableFrom?: Date } = {},
): Promise<SubmitResult> {
  try {
    const res = await horizon(network).submitTransaction(tx, { skipMemoRequiredCheck: true });
    return { ok: true, hash: res.hash };
  } catch (e) {
    const codes = extractResultCodes(e);
    if (!codes.transaction) throw e; // transport error, not a network rejection
    return { ok: false, error: mapSubmitError(codes, ctx) };
  }
}

export function explorerTxUrl(network: NetworkName, hash: string) {
  return `${NETWORKS[network].explorer}/tx/${hash}`;
}

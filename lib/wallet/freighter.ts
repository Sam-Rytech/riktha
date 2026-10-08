"use client";

import {
  getAddress, getNetworkDetails, isConnected, requestAccess, signTransaction,
} from "@stellar/freighter-api";
import { NETWORKS, NetworkName } from "@/lib/core/config";

export class WalletError extends Error {}

const unwrap = <T extends { error?: unknown }>(r: T): T => {
  if (r.error) {
    const e = r.error as { message?: string } | string;
    throw new WalletError(typeof e === "string" ? e : e.message ?? "Freighter error");
  }
  return r;
};

export async function hasFreighter(): Promise<boolean> {
  try {
    return (await isConnected()).isConnected;
  } catch {
    return false;
  }
}

/** Prompts the user to allow this site, then returns their address. */
export async function connect(): Promise<string> {
  if (!(await hasFreighter())) throw new WalletError("Freighter isn't installed. Get it at freighter.app.");
  return unwrap(await requestAccess()).address;
}

export async function currentAddress(): Promise<string | null> {
  const r = await getAddress();
  return r.error || !r.address ? null : r.address;
}

/** Throws unless Freighter is set to the expected network. */
export async function assertNetwork(network: NetworkName): Promise<void> {
  const d = unwrap(await getNetworkDetails());
  if (d.networkPassphrase !== NETWORKS[network].passphrase) {
    throw new WalletError(`Switch Freighter to ${network === "testnet" ? "Testnet" : "Mainnet"} and try again.`);
  }
}

/** Signs any envelope XDR (plain or fee-bump) and returns the signed XDR. */
export async function signXdr(xdr: string, network: NetworkName, address?: string): Promise<string> {
  return unwrap(await signTransaction(xdr, { networkPassphrase: NETWORKS[network].passphrase, address })).signedTxXdr;
}

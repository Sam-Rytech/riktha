"use client";

import { NetworkName } from "@/lib/core/config";
import { assertNetwork, connect, signXdr } from "./freighter";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as NetworkName;

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/** Connect Freighter, sign the SEP-10 challenge, receive the session cookie. Returns the address. */
export async function signIn(): Promise<string> {
  const address = await connect();
  await assertNetwork(NETWORK);
  const { xdr } = await json<{ xdr: string }>(await fetch(`/api/auth/challenge?address=${address}`));
  const signedXdr = await signXdr(xdr, NETWORK, address);
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedXdr }),
  });
  return (await json<{ address: string }>(res)).address;
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function whoAmI(): Promise<string | null> {
  return (await json<{ address: string | null }>(await fetch("/api/auth/me", { cache: "no-store" }))).address;
}

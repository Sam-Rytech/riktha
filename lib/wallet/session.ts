"use client";

import { useEffect, useSyncExternalStore } from "react";
import { NetworkName } from "@/lib/core/config";
import { assertNetwork, connect, signXdr } from "./freighter";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as NetworkName;

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/* ---------- Shared session state ----------
 * One store for "who is signed in", so every sign-in button, gate and banner agrees. Signing in or out anywhere
 * updates all of them at once, and other tabs follow via a BroadcastChannel. */

export interface Session { address: string | null; loaded: boolean }
const UNKNOWN: Session = { address: null, loaded: false };
let session: Session = UNKNOWN;
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("riktha-session");
channel?.addEventListener("message", (e) => setSession((e.data as { address: string | null }).address, false));

function setSession(address: string | null, broadcast = true) {
  if (session.loaded && session.address === address) return;
  session = { address, loaded: true };
  listeners.forEach((l) => l());
  if (broadcast) channel?.postMessage({ address });
}

let inflight: Promise<string | null> | null = null;
/** Re-read the session cookie from the server (deduplicated). */
export function refreshSession(): Promise<string | null> {
  inflight ??= whoAmI().catch(() => null).then((a) => { setSession(a); return a; }).finally(() => { inflight = null; });
  return inflight;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** The signed-in address (`loaded` is false until the first check finishes). */
export function useSession(): Session {
  const s = useSyncExternalStore(subscribe, () => session, () => UNKNOWN);
  useEffect(() => {
    if (!session.loaded) refreshSession();
    const onFocus = () => { refreshSession(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return s;
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
  const { address: signed } = await json<{ address: string }>(res);
  setSession(signed);
  return signed;
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  setSession(null);
}

export async function whoAmI(): Promise<string | null> {
  return (await json<{ address: string | null }>(await fetch("/api/auth/me", { cache: "no-store" }))).address;
}

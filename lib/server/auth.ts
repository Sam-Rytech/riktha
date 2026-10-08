import "server-only";
import { Keypair, StrKey, WebAuth } from "@stellar/stellar-sdk";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { ENABLED_NETWORKS, NETWORKS, NetworkName } from "@/lib/core/config";

export const SESSION_COOKIE = "riktha_session";
const SESSION_DAYS = 7;
const CHALLENGE_TIMEOUT_SECONDS = 300;

export interface Session { address: string; network: NetworkName }

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) { super(message); }
}

export function appNetwork(): NetworkName {
  const n = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as NetworkName;
  if (!ENABLED_NETWORKS.includes(n)) throw new Error(`Network ${n} is not enabled`);
  return n;
}

function serverKeypair(): Keypair {
  const s = process.env.SEP10_SIGNING_SECRET;
  if (!s) throw new Error("SEP10_SIGNING_SECRET is not set");
  return Keypair.fromSecret(s);
}

function jwtKey(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

/** SEP-10-style challenge; `host` (e.g. "riktha.vercel.app") is both home and web-auth domain. */
export function createChallenge(address: string, host: string): { xdr: string; networkPassphrase: string } {
  if (!StrKey.isValidEd25519PublicKey(address)) throw new AuthError("Invalid Stellar address", 400);
  const networkPassphrase = NETWORKS[appNetwork()].passphrase;
  const xdr = WebAuth.buildChallengeTx(serverKeypair(), address, host, CHALLENGE_TIMEOUT_SECONDS, networkPassphrase, host);
  return { xdr, networkPassphrase };
}

/** Verifies the client-signed challenge and returns the client's address. */
export function verifyChallenge(signedXdr: string, host: string): string {
  const passphrase = NETWORKS[appNetwork()].passphrase;
  const serverId = serverKeypair().publicKey();
  try {
    const { clientAccountID } = WebAuth.readChallengeTx(signedXdr, serverId, passphrase, host, host);
    WebAuth.verifyChallengeTxSigners(signedXdr, serverId, passphrase, [clientAccountID], host, host);
    return clientAccountID;
  } catch (e) {
    throw new AuthError(`Sign-in failed: ${(e as Error).message}`);
  }
}

export async function createSessionToken(address: string): Promise<string> {
  return new SignJWT({ net: appNetwork() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(address)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(jwtKey());
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ["HS256"] });
    if (!payload.sub || payload.net !== appNetwork()) return null;
    return { address: payload.sub, network: payload.net as NetworkName };
  } catch {
    return null;
  }
}

export async function setSessionCookie(address: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(address), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError("Sign in first");
  return s;
}

/** Host used as the SEP-10 home/web-auth domain, taken from the incoming request. */
export function requestHost(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) throw new AuthError("Missing host header", 400);
  return host;
}

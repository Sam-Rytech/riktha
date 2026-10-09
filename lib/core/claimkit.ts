// A§15 heir claim kit: the heir's secret key, encrypted in the owner's browser with a 6-word claim code.
// Isomorphic (WebCrypto exists in browsers and Node 22). The server only ever sees the ciphertext.
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";

export const KIT_ITERATIONS = 600_000;
export const CODE_WORDS = 6;

export const claimKitSchema = z.object({
  v: z.literal(1),
  kdf: z.literal("PBKDF2-SHA256"),
  iterations: z.number().int().min(100_000).max(10_000_000),
  salt: z.string().min(16),
  iv: z.string().min(12),
  ciphertext: z.string().min(16),
  heirPublic: z.string().refine((s) => StrKey.isValidEd25519PublicKey(s), "invalid heir key"),
});
export type ClaimKit = z.infer<typeof claimKitSchema>;

const subtle = () => globalThis.crypto.subtle;
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
const aad = (owner: string, heirPublic: string) => new TextEncoder().encode(`riktha-kit/v1|${owner}|${heirPublic}`);

/** Six random BIP-39 words (66 bits), unbiased: 2048 divides 2^16. */
export function generateClaimCode(): string {
  const r = globalThis.crypto.getRandomValues(new Uint16Array(CODE_WORDS));
  return Array.from(r, (n) => wordlist[n % 2048]).join(" ");
}

/** Lowercase, single spaces; tolerant of commas, dashes and line breaks people add when copying. */
export function normalizeCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z]+/g, " ").trim();
}

export function isValidCode(code: string): boolean {
  const words = normalizeCode(code).split(" ");
  return words.length === CODE_WORDS && words.every((w) => wordlist.includes(w));
}

async function deriveKey(code: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", new TextEncoder().encode(normalizeCode(code)), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function createKit(heirSecret: string, owner: string, code: string, iterations = KIT_ITERATIONS): Promise<ClaimKit> {
  const heirPublic = Keypair.fromSecret(heirSecret).publicKey();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt, iterations);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: aad(owner, heirPublic) as BufferSource }, key, new TextEncoder().encode(heirSecret));
  return { v: 1, kdf: "PBKDF2-SHA256", iterations, salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(ct)), heirPublic };
}

export class WrongCodeError extends Error {
  constructor() { super("That claim code doesn't open this kit. Check each word and try again."); }
}

/** Returns the heir keypair, or throws WrongCodeError (wrong code, wrong owner or tampered kit). */
export async function openKit(kit: ClaimKit, owner: string, code: string): Promise<Keypair> {
  try {
    const key = await deriveKey(code, unb64(kit.salt), kit.iterations);
    const pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(kit.iv) as BufferSource, additionalData: aad(owner, kit.heirPublic) as BufferSource }, key, unb64(kit.ciphertext) as BufferSource);
    const kp = Keypair.fromSecret(new TextDecoder().decode(pt));
    if (kp.publicKey() !== kit.heirPublic) throw new Error("key mismatch");
    return kp;
  } catch {
    throw new WrongCodeError();
  }
}

/** Owner-side helper: a fresh heir key plus its kit and code. */
export async function newHeirKit(owner: string, iterations = KIT_ITERATIONS) {
  const heir = Keypair.random();
  const code = generateClaimCode();
  const kit = await createKit(heir.secret(), owner, code, iterations);
  return { heirPublic: heir.publicKey(), code, kit };
}

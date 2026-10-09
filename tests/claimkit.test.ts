import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  claimKitSchema, createKit, generateClaimCode, isValidCode, newHeirKit, normalizeCode, openKit, WrongCodeError,
} from "@/lib/core/claimkit";

const owner = Keypair.random().publicKey();
const FAST = 1000; // iterations for tests; production uses 600k

describe("claim codes", () => {
  it("are six valid BIP-39 words and differ each time", () => {
    const a = generateClaimCode(), b = generateClaimCode();
    expect(a.split(" ")).toHaveLength(6);
    expect(isValidCode(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it("normalize copy-paste noise", () => {
    expect(normalizeCode("  Apple, BANANA-cherry\ndog  egg fish ")).toBe("apple banana cherry dog egg fish");
  });
  it("reject wrong lengths and non-words", () => {
    expect(isValidCode("abandon abandon abandon")).toBe(false);
    expect(isValidCode("abandon abandon abandon abandon abandon zzzzz")).toBe(false);
  });
});

describe("claim kit", () => {
  it("round-trips with the right code (any spacing/case)", async () => {
    const { kit, code, heirPublic } = await newHeirKit(owner, FAST);
    expect(claimKitSchema.safeParse(kit).success).toBe(false); // schema refuses weak (test-speed) KDF settings
    expect(claimKitSchema.parse({ ...kit, iterations: 600_000 }).heirPublic).toBe(heirPublic);
    const kp = await openKit(kit, owner, `  ${code.toUpperCase().replace(/ /g, " , ")} `);
    expect(kp.publicKey()).toBe(heirPublic);
  });
  it("never contains the secret in clear", async () => {
    const heir = Keypair.random();
    const kit = await createKit(heir.secret(), owner, generateClaimCode(), FAST);
    expect(JSON.stringify(kit)).not.toContain(heir.secret());
  });
  it("rejects a wrong code", async () => {
    const { kit } = await newHeirKit(owner, FAST);
    await expect(openKit(kit, owner, generateClaimCode())).rejects.toBeInstanceOf(WrongCodeError);
  });
  it("is bound to the owner (AAD)", async () => {
    const { kit, code } = await newHeirKit(owner, FAST);
    await expect(openKit(kit, Keypair.random().publicKey(), code)).rejects.toBeInstanceOf(WrongCodeError);
  });
  it("detects tampering", async () => {
    const { kit, code } = await newHeirKit(owner, FAST);
    const bytes = Buffer.from(kit.ciphertext, "base64");
    bytes[0] ^= 1;
    await expect(openKit({ ...kit, ciphertext: bytes.toString("base64") }, owner, code)).rejects.toBeInstanceOf(WrongCodeError);
    await expect(openKit({ ...kit, heirPublic: Keypair.random().publicKey() }, owner, code)).rejects.toBeInstanceOf(WrongCodeError);
  });
});

// End-to-end check of SEP-10-style sign-in against a running app (default http://localhost:3000).
// Run: pnpm tsx scripts/e2e-auth.mts [baseUrl]
import { Keypair, Networks, TransactionBuilder, Transaction } from "@stellar/stellar-sdk";

const base = process.argv[2] ?? "http://localhost:3000";
let failures = 0;
const check = (label: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
};

async function challenge(address: string) {
  const r = await fetch(`${base}/api/auth/challenge?address=${address}`);
  return { status: r.status, body: (await r.json()) as { xdr?: string; networkPassphrase?: string; error?: string } };
}
async function verify(signedXdr: string) {
  const r = await fetch(`${base}/api/auth/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr }),
  });
  return { status: r.status, cookie: r.headers.get("set-cookie") ?? "", body: await r.json() };
}
const sign = (xdr: string, kp: Keypair) => {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  tx.sign(kp);
  return tx.toXDR();
};

const user = Keypair.random(), other = Keypair.random();

const bad = await challenge("not-an-address");
check("rejects an invalid address", bad.status === 400, String(bad.status));

const c = await challenge(user.publicKey());
check("issues a challenge", c.status === 200 && !!c.body.xdr);
check("challenge is for testnet", c.body.networkPassphrase === Networks.TESTNET);

const wrong = await verify(sign(c.body.xdr!, other));
check("rejects a challenge signed by the wrong key", wrong.status === 401, String(wrong.status));

const unsigned = await verify(c.body.xdr!);
check("rejects an unsigned challenge", unsigned.status === 401, String(unsigned.status));

const ok = await verify(sign(c.body.xdr!, user));
check("accepts the correctly signed challenge", ok.status === 200 && ok.body.address === user.publicKey());
check("sets an httpOnly session cookie", /riktha_session=/.test(ok.cookie) && /HttpOnly/i.test(ok.cookie));

const cookie = ok.cookie.split(";")[0];
const me = await (await fetch(`${base}/api/auth/me`, { headers: { cookie } })).json();
check("/me returns the signed-in address", me.address === user.publicKey());

const anon = await (await fetch(`${base}/api/auth/me`)).json();
check("/me without a cookie is anonymous", anon.address === null);

const forged = await (await fetch(`${base}/api/auth/me`, { headers: { cookie: `${cookie}x` } })).json();
check("/me rejects a tampered cookie", forged.address === null);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll auth checks passed");
process.exit(failures ? 1 : 0);

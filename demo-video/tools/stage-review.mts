// Follow-up capture: the review step with the claim-code box ticked (Sign & arm enabled). Real wizard, real draft.
//   pnpm tsx demo-video/tools/stage-review.mts [http://localhost:3000]
import { config } from "dotenv";
import { chromium } from "playwright";
import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

config({ path: ".env.local", quiet: true });
const base = process.argv[2] ?? "http://localhost:3000";
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const owner = Keypair.random();
for (let i = 0; i < 6; i++) { try { if ((await fetch(`https://friendbot.stellar.org?addr=${owner.publicKey()}`)).ok) break; } catch { /* retry */ } await sleep(3); }
const { xdr } = await (await fetch(`${base}/api/auth/challenge?address=${owner.publicKey()}`)).json();
const t = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction; t.sign(owner);
const vr = await fetch(`${base}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr: t.toXDR() }) });
const value = (vr.headers.get("set-cookie") ?? "").split(";")[0].split("=").slice(1).join("=");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name: "riktha_session", value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
const p = await ctx.newPage();
await p.goto(`${base}/plan/new`, { waitUntil: "networkidle" });
await p.getByLabel("No, they don't use crypto").check({ force: true });
await p.getByPlaceholder("name@example.com").fill("ada@example.com");
await p.getByRole("button", { name: "Continue" }).click();
await p.getByLabel("180 days").check({ force: true });
await p.getByRole("button", { name: "Review plan" }).click();
const box = p.getByLabel(/written down the code/);
await box.waitFor({ timeout: 60000 });
await box.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
await p.screenshot({ path: "demo-video/assets/screens/16-review-code-unticked.png" });
await box.check({ force: true }); await p.waitForTimeout(600);
await p.screenshot({ path: "demo-video/assets/screens/17-review-code-ticked.png" });
console.log("captured 16, 17");
await browser.close();

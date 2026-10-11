// Follow-up captures: the "I'm alive" reset on a short real plan (the countdown visibly jumps back),
// and the wizard's Custom fields. Real testnet transactions; run like stage.mts:
//   pnpm tsx demo-video/tools/stage-alive.mts [http://localhost:3000]
import { join } from "node:path";
import { config } from "dotenv";
import { chromium } from "playwright";
import { Horizon, Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildCheckIn } from "../../lib/core/builders";
import { newHeirKit } from "../../lib/core/claimkit";

config({ path: ".env.local", quiet: true });
const base = process.argv[2] ?? "http://localhost:3000";
const OUT = "demo-video/assets/screens";
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const signXdr = (xdr: string, kp: Keypair) => { const t = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction; t.sign(kp); return t; };
const fund = async (kp: Keypair) => { for (let i = 0; i < 6; i++) { try { if ((await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)).ok) return; } catch { /* retry */ } await sleep(3); } throw new Error("friendbot"); };

const owner = Keypair.random();
await fund(owner);
const { xdr } = await (await fetch(`${base}/api/auth/challenge?address=${owner.publicKey()}`)).json();
const vr = await fetch(`${base}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr: signXdr(xdr, owner).toXDR() }) });
const pair = (vr.headers.get("set-cookie") ?? "").split(";")[0];
const api = async (path: string, json?: unknown) => (await fetch(`${base}${path}`, { method: json ? "POST" : "GET", headers: { cookie: pair, "Content-Type": "application/json" }, body: json ? JSON.stringify(json) : undefined })).json();

const { heirPublic, kit } = await newHeirKit(owner.publicKey());
const draft = await api("/api/plans", { heir: heirPublic, heirKit: kit, heirEmail: "ada@example.com", inactivitySeconds: 600, graceSeconds: 120 });
const setup = await horizon.submitTransaction(signXdr(draft.setupXdr, owner));
for (let i = 0; i < 8; i++) { const r = await api(`/api/plans/${draft.planId}/confirm`, { txHash: setup.hash }); if (!r.error) break; await sleep(2); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name: "riktha_session", value: pair.split("=").slice(1).join("="), domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
const p = await ctx.newPage();

await p.goto(`${base}/plan/new`, { waitUntil: "networkidle" });
await p.getByLabel("No, they don't use crypto").check({ force: true });
await p.getByPlaceholder("name@example.com").fill("ada@example.com");
await p.getByRole("button", { name: "Continue" }).click();
await p.getByLabel("Custom").check({ force: true });
await p.getByLabel("Wait this long (number)").fill("270");
await p.getByLabel("Then time to respond (number)").fill("45");
await p.waitForTimeout(800);
await p.screenshot({ path: join(OUT, "13-wizard-timing-custom.png") });
console.log("captured 13-wizard-timing-custom");

console.log("letting the 10-minute clock run down a little…");
await sleep(150);
await p.goto(`${base}/dashboard`, { waitUntil: "networkidle" }); await p.waitForTimeout(3000);
await p.screenshot({ path: join(OUT, "27-dashboard-before-alive.png") });
console.log("captured 27-dashboard-before-alive");
const acct = await horizon.loadAccount(owner.publicKey());
const ci = buildCheckIn("testnet", owner.publicKey(), BigInt(acct.sequenceNumber())); ci.sign(owner);
await horizon.submitTransaction(ci);
await sleep(6);
await p.goto(`${base}/dashboard`, { waitUntil: "networkidle" }); await p.waitForTimeout(3000);
await p.screenshot({ path: join(OUT, "28-dashboard-after-alive.png") });
console.log("captured 28-dashboard-after-alive");
await browser.close();

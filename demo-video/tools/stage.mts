/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a capture harness */
// Stage every product state the film needs on REAL testnet transactions, and screenshot each one.
// Nothing is mocked: fresh Friendbot accounts, real plans through the app's API, the keeper's own tick
// endpoint, and the heir's claim + send driven through the real /inherit page in a real browser.
//
// Run from the repo root against a local production build (pnpm build && pnpm start):
//   pnpm tsx demo-video/tools/stage.mts [http://localhost:3000]
// Writes demo-video/assets/screens/*.png and demo-video/assets/stage.local.json (git-ignored: test keys,
// session cookie and claim codes for these throwaway testnet accounts).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { chromium, type Page } from "playwright";
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildCheckIn } from "../../lib/core/builders";
import { newHeirKit } from "../../lib/core/claimkit";
import { render, toEmail } from "../../lib/server/notify/templates";

config({ path: ".env.local", quiet: true });
const base = process.argv[2] ?? "http://localhost:3000";
const OUT = "demo-video/assets/screens";
mkdirSync(OUT, { recursive: true });
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const DAY = 86_400, W = 60;
const HEIR_EMAIL = "ada@example.com"; // reserved domain: the app never emails it
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const fund = async (kp: Keypair) => {
  for (let i = 0; i < 6; i++) { try { if ((await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)).ok) return; } catch { /* retry */ } await sleep(3); }
  throw new Error("friendbot");
};
const signXdr = (xdr: string, kp: Keypair) => { const t = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction; t.sign(kp); return t; };
const send = (tx: any) => horizon.submitTransaction(tx, { skipMemoRequiredCheck: true });
const tick = async (id: string) => fetch(`${base}/api/cron/tick?only=${id}`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }).then((r) => r.json()).catch(() => ({}));

/** The app's real SEP-10 sign-in, signed with the throwaway owner key. Returns the session cookie value. */
async function signIn(owner: Keypair) {
  const { xdr } = await (await fetch(`${base}/api/auth/challenge?address=${owner.publicKey()}`)).json();
  const vr = await fetch(`${base}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr: signXdr(xdr, owner).toXDR() }) });
  const pair = (vr.headers.get("set-cookie") ?? "").split(";")[0];
  return { pair, value: pair.split("=").slice(1).join("=") };
}
const apiWith = (cookie: string) => async (path: string, init: { method?: string; json?: unknown } = {}) => {
  const r = await fetch(`${base}${path}`, { method: init.method ?? "GET", headers: { cookie, "Content-Type": "application/json" }, body: init.json ? JSON.stringify(init.json) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) as any };
};

/** Fund an owner holding XLM plus 250 RIK (a test asset), like scripts/seed-demo.ts. */
async function richOwner() {
  const owner = Keypair.random(), issuer = Keypair.random();
  await Promise.all([fund(owner), fund(issuer)]);
  const RIK = new Asset("RIK", issuer.publicKey());
  const trust = new TransactionBuilder(await horizon.loadAccount(owner.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: RIK })).setTimeout(60).build();
  trust.sign(owner); await send(trust);
  const pay = new TransactionBuilder(await horizon.loadAccount(issuer.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: owner.publicKey(), asset: RIK, amount: "250" })).setTimeout(60).build();
  pay.sign(issuer); await send(pay);
  return owner;
}

/** Create + arm a claim-kit plan exactly as the wizard does. */
async function armKitPlan(owner: Keypair, api: ReturnType<typeof apiWith>, I: number, G: number) {
  const { heirPublic, code, kit } = await newHeirKit(owner.publicKey());
  const draft = await api("/api/plans", { method: "POST", json: { heir: heirPublic, heirKit: kit, heirEmail: HEIR_EMAIL, inactivitySeconds: I, graceSeconds: G } });
  if (draft.status !== 200) throw new Error(`draft: ${draft.body.error}`);
  const setup = await send(signXdr(draft.body.setupXdr, owner));
  for (let i = 0; i < 8; i++) { if ((await api(`/api/plans/${draft.body.planId}/confirm`, { method: "POST", json: { txHash: setup.hash } })).status === 200) return { planId: draft.body.planId as string, code, heirPublic }; await sleep(2); }
  throw new Error("confirm failed");
}

async function waitState(api: ReturnType<typeof apiWith>, id: string, want: string[], maxS: number) {
  for (let t = 0; t < maxS; t += 5) {
    await tick(id);
    const s = (await api(`/api/plans/${id}`)).body.state;
    if (want.includes(s)) return s;
    await sleep(5);
  }
  throw new Error(`plan ${id} never reached ${want.join("/")}`);
}

const browser = await chromium.launch();
async function pageFor(cookie?: string) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  if (cookie) await ctx.addCookies([{ name: "riktha_session", value: cookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  return ctx.newPage();
}
async function shot(page: Page, name: string, opts: { full?: boolean; settle?: number } = {}) {
  await page.waitForTimeout((opts.settle ?? 1.2) * 1000);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: !!opts.full });
  log("captured", name);
}
const go = async (page: Page, path: string) => { await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {}); };

const stage: Record<string, unknown> = { base, createdAt: new Date().toISOString() };

// ---------- Public screens ----------
{
  const p = await pageFor();
  await go(p, "/"); await shot(p, "01-landing-hero", { settle: 3 });
  await go(p, "/evidence"); await shot(p, "40-evidence-top", { settle: 2 }); await shot(p, "41-evidence-full", { full: true });
  const row = p.locator("tr", { hasText: "early" }).first();
  if (await row.count()) { await row.screenshot({ path: join(OUT, "42-evidence-rejected-row.png") }); log("captured 42-evidence-rejected-row"); }
  await p.context().close();
}

// ---------- Owner A: 180-day plan (wizard + dashboard) ----------
log("Funding owner A (XLM + RIK)…");
const ownerA = await richOwner();
const sessA = await signIn(ownerA);
const apiA = apiWith(sessA.pair);
{
  const p = await pageFor(sessA.value);
  await go(p, "/plan/new"); await shot(p, "10-wizard-heir-empty", { settle: 2 });
  await p.getByLabel("No, they don't use crypto").check({ force: true });
  await p.getByPlaceholder("name@example.com").fill(HEIR_EMAIL);
  await shot(p, "11-wizard-heir-filled");
  await p.getByRole("button", { name: "Continue" }).click();
  await p.getByLabel("180 days").check({ force: true });
  await shot(p, "12-wizard-timing-180");
  await p.getByLabel("Custom").check({ force: true });
  await shot(p, "13-wizard-timing-custom");
  await p.getByLabel("180 days").check({ force: true });
  await p.getByRole("button", { name: "Review plan" }).click();
  await p.getByRole("button", { name: /Sign & arm/ }).waitFor({ timeout: 60000 });
  await shot(p, "14-wizard-review", { settle: 2 }); await shot(p, "15-wizard-review-full", { full: true });
  await p.context().close();
}
log("Arming owner A's 180-day plan…");
const planA = await armKitPlan(ownerA, apiA, 180 * DAY, 30 * DAY);
{
  const p = await pageFor(sessA.value);
  await go(p, "/dashboard"); await shot(p, "20-dashboard-armed", { settle: 4 }); await shot(p, "21-dashboard-armed-full", { full: true });
  // "I'm alive": the same check-in transaction the button builds, signed by the owner's key.
  const acct = await horizon.loadAccount(ownerA.publicKey());
  const ci = buildCheckIn("testnet", ownerA.publicKey(), BigInt(acct.sequenceNumber())); ci.sign(ownerA); await send(ci);
  await sleep(6); await tick(planA.planId);
  await go(p, "/dashboard"); await shot(p, "22-dashboard-after-alive", { settle: 4 });
  await p.context().close();
}

// ---------- Owner B: 60-second claim-kit plan, run all the way to the heir spending ----------
log("Funding owner B (XLM + RIK) and an 'exchange' account…");
const exchange = Keypair.random();
const [ownerB] = await Promise.all([richOwner(), fund(exchange)]);
const sessB = await signIn(ownerB);
const apiB = apiWith(sessB.pair);
const planB = await armKitPlan(ownerB, apiB, W, W);
const ownerPage = await pageFor(sessB.value);
await go(ownerPage, "/dashboard"); await shot(ownerPage, "23-dashboardB-armed", { settle: 4 });
const heirPage = await pageFor();
await go(heirPage, `/inherit/${planB.planId}`); await shot(heirPage, "30-inherit-armed", { settle: 3 });

log(`Waiting for the ${W}s inactivity window…`);
await sleep(W + 6);
await waitState(apiB, planB.planId, ["NOTICE", "CLAIMABLE"], 90);
await go(ownerPage, "/dashboard"); await shot(ownerPage, "24-dashboardB-notice", { settle: 4 }); await shot(ownerPage, "25-dashboardB-notice-full", { full: true });
await go(heirPage, `/inherit/${planB.planId}`); await shot(heirPage, "31-inherit-notice", { settle: 3 });

log(`Waiting for the ${W}s grace window…`);
await sleep(W + 4);
await waitState(apiB, planB.planId, ["CLAIMABLE"], 60).catch(() => log("still NOTICE by API; the page computes from chain"));
await go(heirPage, `/inherit/${planB.planId}`); await shot(heirPage, "32-inherit-claimable", { settle: 3 });
await heirPage.getByPlaceholder("six words separated by spaces").fill(planB.code);
await shot(heirPage, "33-inherit-code-typed", { settle: 0.5 });
await heirPage.getByRole("button", { name: "Unlock" }).click();
await heirPage.getByRole("button", { name: "Claim the inheritance" }).waitFor({ timeout: 90000 });
await shot(heirPage, "34-inherit-unlocked", { settle: 1 });
await heirPage.getByRole("button", { name: "Claim the inheritance" }).click();
await heirPage.getByPlaceholder("G…").waitFor({ timeout: 120000 });
await shot(heirPage, "35-inherit-wallet", { settle: 3 }); await shot(heirPage, "36-inherit-wallet-full", { full: true });
await heirPage.getByPlaceholder("G…").fill(exchange.publicKey());
await heirPage.getByPlaceholder("0.00").fill("2500");
const memo = heirPage.locator("input[maxlength='28']"); if (await memo.count()) await memo.fill("4471");
await shot(heirPage, "37-inherit-send-filled", { settle: 0.5 });
await heirPage.getByRole("button", { name: "Review" }).click();
await shot(heirPage, "38-inherit-send-review", { settle: 0.8 });
await heirPage.getByRole("button", { name: /Send now/ }).click();
await heirPage.waitForTimeout(9000);
await shot(heirPage, "39-inherit-sent", { settle: 1 }); await shot(heirPage, "39b-inherit-sent-full", { full: true });
await tick(planB.planId);
await go(ownerPage, "/dashboard"); await shot(ownerPage, "26-dashboardB-inherited", { settle: 4 });

// ---------- Emails, rendered from the app's own templates ----------
{
  const ctx = { appUrl: "https://riktha.vercel.app", owner: ownerB.publicKey(), heir: planB.heirPublic, inactivitySeconds: 180 * DAY, graceSeconds: 30 * DAY, heirKind: "kit" as const, planId: planB.planId, claimableAt: Math.floor(Date.now() / 1000) + 30 * DAY };
  const p = await pageFor();
  await p.setViewportSize({ width: 720, height: 640 });
  for (const [kind, urgent, file, reason] of [
    ["NOTICE_OWNER", true, "50-email-owner-notice", undefined],
    ["CLAIMABLE_HEIR", false, "51-email-heir-claimable", "the owner of a Stellar account named you as their heir on Riktha"],
    ["ARMED_HEIR", false, "52-email-heir-named", "the owner of a Stellar account named you as their heir on Riktha"],
  ] as const) {
    await p.setContent(toEmail(render(kind, ctx), urgent, reason).html);
    await shot(p, file, { settle: 0.3, full: true });
  }
  await p.context().close();
}

stage.ownerA = { public: ownerA.publicKey(), secret: ownerA.secret(), planId: planA.planId, code: planA.code };
stage.ownerB = { public: ownerB.publicKey(), secret: ownerB.secret(), planId: planB.planId, code: planB.code };
stage.exchange = exchange.publicKey();
writeFileSync("demo-video/assets/stage.local.json", JSON.stringify(stage, null, 2));
await browser.close();
log("done");

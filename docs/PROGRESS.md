# Riktha — Progress Tracker

Single source of truth for *where we are*. Update after every work session.
Specs: `PRD.md` (what/why), `ARCHITECTURE.md` (how). Section references like "A§2.4" mean ARCHITECTURE §2.4.

**Deadline: 2026-10-12 23:59 UTC = Tue 2026-10-13 00:59 Lagos.**
**Internal target: submitted by Mon 2026-10-12 21:00 Lagos** (3 h buffer).

Status keys: ⬜ todo · 🟨 in progress · ✅ done · ⛔ blocked · ✂️ cut

---

## Current status

| | |
|---|---|
| Phase | Build complete; next: deploy, account wiring and full testing with Sam |
| Next action | Accounts session: Gmail app password, NEXT_PUBLIC_APP_URL in Vercel, Telegram setWebhook, cron-job.org job; then full manual test; then video |
| Blockers | none |
| Last updated | 2026-10-08 |

---

## Day 0 — Thu Oct 8 (evening): accounts + protocol spike  *(~3 h)*

| ID | Task | Acceptance | Status |
|---|---|---|---|
| T0.1 | Create accounts: GitHub repo `riktha` (public, MIT), Vercel project, Neon DB via Vercel Marketplace, Telegram bot via @BotFather (pick username), Gmail app password (or other SMTP), cron-job.org account | All credentials in a local `.env.local` (never committed) | 🟨 GitHub (private), Vercel (linked), Neon, @RikthaBot, cron-job.org signup, secrets in `.env.local` ✅ · email provider + Vercel env vars pending |
| T0.2 | Run spike (A Appendix A) on testnet | Every SP1–SP7 row below filled in | ✅ all 7 passed |
| T0.3 | Decide variant + SEQ_JUMP from spike | Decision log updated; A§2.2 updated | ✅ |
| T0.4 | Scaffold: Next.js + TS + Tailwind + pnpm, add `@stellar/stellar-sdk`, `@stellar/freighter-api`, `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`, `zod`, `jose`, `nodemailer`, `vitest`, `tsx`; copy docs into `docs/` | `pnpm dev` runs; first commit pushed; Vercel deploys the blank app | 🟨 scaffolded, builds, tests pass; push + Vercel wait for T0.1 |

### Spike results

Run 2026-10-08 with `pnpm spike` → `scripts/spike-results.json`. Hashes are on stellar.expert/explorer/testnet.

| ID | Question | Result | Tx hash / codes | Decision |
|---|---|---|---|---|
| SP1 | Seq jump 1e9 accepted? | ✅ Yes, both on a direct probe and on Phase 1. The account seq landed exactly on s1. | probe `f4dd9f2e…2b13`; Phase 1 `337108a4…957c` | Keep `SEQ_JUMP = 1_000_000_000n` |
| SP2 | `sequence_time` present + updated by setup? | ✅ It is **absent** on a fresh friendbot account (no V3 extension) and present after setup. | setup `27077ec2…1c5c` | Treat a missing value as 0 (already in `derivePlanState`) |
| SP3 | Sponsored Phase 2 works? | ✅ Heir signer added, `sponsor` = heir, `num_sponsored` = 1 | `af4b9438…0fbf` | Works, but not the default (see SP4) |
| SP4 | Plain Phase 2 at minimum balance works? | ✅ The owner sat at exactly 4 reserves after setup, and Phase 2 still succeeded. Phase 1 removes its own pre-auth signer, which frees one reserve before Phase 2 can run. The owner can't spend that reserve without cancelling the claim. | `f0f94e86…e0e7`; plain `9b1de94d…7014` | **Plain is the default.** No reserve guard and no LOW_RESERVE notification. |
| SP5 | Error string for early submission | ✅ Fee-bumped: `tx_fee_bump_inner_failed` + inner `tx_bad_minseq_age_or_gap`. Inner-only: `tx_bad_minseq_age_or_gap`. Both pre-auth signers were still present afterwards. | (rejections) | Mapped in `lib/core/errors.ts` |
| SP5b | Phase 1 submitted **without** a fee-bump (owner pays the fee)? | ✅ Works | `437da352…edba` | Fallback if fee-bump signing fails (SP7) |
| SP6 | Freighter signs PreconditionsV2 XDR? | ✅ Signed (1 signature), via `/dev/sign-test` | (not submitted) | The sponsored variant stays viable; plain is still the default |
| SP7 | Freighter signs a fee-bump envelope? | ✅ Signed and submitted | `271aaeed…6b88` | The heir pays Phase 1/2 fees via fee-bump from the browser; inner-only stays as a fallback |

**Gate:** if SP1 *and* SP2 fail in ways the fallbacks can't fix, stop and switch to the backup idea (Tripwire) tomorrow morning. Otherwise continue.

---

## Day 1 — Fri Oct 9: core library + plan creation

| ID | Task | Acceptance | Status |
|---|---|---|---|
| T1.1 | `lib/core/config.ts` (networks, SEQ_JUMP, presets, minimums) | Matches A§5 | ✅ |
| T1.2 | `lib/core/builders.ts`: buildPlan (both variants), buildRevoke, buildCheckIn, buildEstateTransfer, wrapFeeBump | Unit tests from A§5 pass | ✅ |
| T1.3 | `lib/core/state.ts` derivePlanState | One passing test per branch of A§2.7 | ✅ |
| T1.4 | `lib/core/packet.ts` make/parse/verify (zod) | Round-trip + tamper tests pass | ✅ |
| T1.5 | `lib/core/eligibility.ts`, `errors.ts`, `explain.ts` | Ineligible accounts get clear messages; codes in A§2.6 mapped | ✅ |
| T1.6 | `lib/stellar/horizon.ts` (raw account, base reserve from latest ledger, submit with error extraction) | Works against testnet | ✅ `lib/stellar/horizon.ts` (raw account, base reserve, tx lookup, submit → mapped errors) |
| T1.7 | `lib/wallet/freighter.ts` (connect, address, network check, sign) | Connect button shows address; wrong-network warning | ✅ wrapper + `ConnectButton` in the header |
| T1.8 | DB schema (A§6) + `drizzle-kit push` to Neon | Tables exist | ✅ 5 tables + indexes live (`pnpm db:push`) |
| T1.9 | Auth: `/api/auth/challenge`, `/verify`, `/logout`, session helper | Sign-in with Freighter works end to end | ✅ challenge/verify/logout/me; `pnpm test:auth` 10/10 against the dev server; real Freighter sign-in to confirm by Sam |
| T1.10 | `POST /api/plans` + `/confirm` | Draft created; confirm verifies signers on chain → ARMED | ✅ `pnpm test:plans`: 19/19 on testnet (real plan armed via the API) |
| T1.11 | `/plan/new` wizard: heir, presets incl. Demo, heir email, review panel (decoded txs), sign setup, confirm | A real testnet plan is armed from the UI | ✅ Sam armed a Demo plan with Freighter |
| T1.12 | Packet download (`/api/plans/:id/packet`) | Downloaded file passes `verifyPacket` | ✅ API + download button; the downloaded packet passes `verifyPacket` (in test:plans) |

**End-of-day check:** create a Demo plan on testnet from the UI, download the packet, commit.

---

## Day 2 — Sat Oct 10: owner dashboard, heir claim, packet claim, estate

| ID | Task | Acceptance | Status |
|---|---|---|---|
| T2.1 | `/dashboard`: state badge, timeline, countdown (live, from `sequence_time`), last activity, reserve health, notification inbox | Countdown matches chain within a few seconds | ✅ `/dashboard`: badge, timeline, live countdown, last activity, inbox (reserve health dropped per SP4) |
| T2.2 | "I'm alive" check-in | Clock visibly resets after the tx | ✅ I'm alive = owner-signed bumpSequence (`lib/client/actions.ts`) |
| T2.3 | NOTICE banner + one-click cancel | Cancel makes Phase 2 permanently invalid (verify `tx_bad_seq`) | ✅ red banner + cancel; `tx_bad_seq` afterwards proven in scenario S6 |
| T2.4 | Re-arm / edit (`/rearm`) and revoke (`/revoke`) | Stale signers removed; new pair confirmed | ✅ re-arm (`/rearm`), edit via the wizard (supersedes), revoke (`/revoke`); covered by test:lifecycle |
| T2.5 | `/heir`: plans naming me, state, dates | Heir sees plan after sign-in | ✅ `/heir` |
| T2.6 | Heir "Start claim" (Phase 1 fee-bumped) and "Complete handover" (Phase 2, heir signs if sponsored, fee-bumped) | Full Demo claim completes from the UI | ✅ shared ClaimActions: fee-bump via Freighter, or owner-paid without a wallet |
| T2.7 | `/claim`: upload packet → verify → derive state from chain only → submit Phase 1/2 | Works with the DB unreachable (test by pointing to a fake DB URL) | ✅ `/claim` uses no API and no DB; verified with Sam's real packet |
| T2.8 | Estate: owner balances + "Send to me" per asset (tx source heir, op source owner) | XLM + one test asset moved on testnet | ✅ EstatePanel adds the heir trustline automatically; XLM + RIK moved in scenario S9 |
| T2.9 | Error UX for every mapped code | No raw Horizon errors shown to users | ✅ all submits go through `mapSubmitError` |

**End-of-day check:** owner → wait → heir claim → estate move, all from the UI, on Demo windows.

---

## Day 3 — Sun Oct 11: keeper, notifications, deploy

| ID | Task | Acceptance | Status |
|---|---|---|---|
| T3.1 | `notify/index.ts` dispatch + dedupe (unique index) + dashboard rows | Re-running a tick sends nothing twice | ✅ per-channel dedupe via unique index; "immediate re-run sends nothing" in test:lifecycle |
| T3.2 | Email: nodemailer SMTP, templates for every kind in A§9, verification link flow, heir invite with packet attached | Emails arrive (check spam); verification works | 🟨 Nodemailer + templates + verification + heir invite with packet attached; needs Sam's Gmail app password to test delivery |
| T3.3 | Telegram: `/api/telegram/link`, webhook (`/start <token>`, `/status`), send messages | Linking from /settings works; alerts arrive | 🟨 link + webhook (`/start`, `/status`) + send; needs the deployed URL for setWebhook |
| T3.4 | `/settings` page (email + Telegram) | Both channels can be linked/unlinked | ✅ `/settings` |
| T3.5 | Keeper `/api/cron/tick` (A§9), incl. auto Phase 1 with keeper account | Demo plan goes ARMED → NOTICE with no human action, and both people are notified | ✅ keeper: ARMED→NOTICE→CLAIMABLE with notifications and auto Phase 1, proven by test:lifecycle |
| T3.6 | Deploy: env vars, Neon, webhook, cron-job.org every minute, Vercel daily backup cron | Production URL runs the full Demo flow | 🟨 vercel.json daily backup cron done; prod env URL, webhook and cron-job.org job wait for the accounts session |
| T3.7 | `scripts/seed-demo.ts` (friendbot owner + heir + test asset) | Fresh demo accounts in < 2 min | ✅ `pnpm seed-demo` |

---

## Day 4 — Mon Oct 12: evidence, polish, video, submit

| ID | Task | Acceptance | Status |
|---|---|---|---|
| T4.1 | `scripts/scenarios.ts` → `docs/evidence.json` (all 10 scenarios, A§11) | 10/10 pass with tx hashes | ✅ 10/10 on testnet → docs/evidence.json |
| T4.2 | `/evidence` page rendering scenarios + stellar.expert links | Live | ✅ `/evidence` |
| T4.3 | Landing page: problem with cited numbers, how it works, protocol diagram, "honest limits" | Reads well on phone | ✅ landing page: problem with sources, mechanism diagram, how it works, guarantees, limits |
| T4.4 | README: summary, why Stellar (CAP-21), architecture diagram, run locally, env vars, evidence link, honest limits, roadmap, sources, MIT | A judge can run it from the README | ✅ README |
| T4.5 | Accessibility pass (keyboard, contrast, labels) | No blocking issues | ✅ labels, focus ring, aria-live, text+symbol states, reduced motion |
| T4.6 | Video (≤ 3 min) — **plan together**, then record + upload (YouTube unlisted) | Link works logged-out | ⬜ |
| T4.7 | Submit on Stellar Passport (checklist below) | Confirmation visible | ⬜ |

---

## Cut order (if behind)

Decide at **Sun Oct 11, 14:00 Lagos**. Cut from the top down, never below the line:

1. ✂️ Edit plan (keep re-arm and revoke)
2. ✂️ Estate: test asset (keep XLM only)
3. ✂️ GRACE_50/90 repeat reminders (keep NOTICE urgent alert)
4. ✂️ Telegram `/status` command (keep alerts)
5. ✂️ Keeper auto Phase 1 (heir presses "Start claim" instead)

---- never cut ----
Setup, packet, dashboard countdown, check-in, cancel, heir claim, `/claim` packet page, email + Telegram + dashboard alerts for NOTICE, evidence page, README, video.

---

## Submission checklist (Stellar Passport form)

- [ ] Registered with GitHub profile (Sam-Rytech)
- [ ] Project name: **Riktha**
- [ ] Description (from README summary; include live URL, evidence URL, honest limits line)
- [ ] Submission Track: **General Track**
- [ ] Email
- [ ] Repo link (public, MIT, README complete)
- [ ] Video link (≤ 3 min, unlisted YouTube, works logged-out)
- [ ] Other links: live app, `/evidence`
- [ ] Terms & Conditions checkbox
- [ ] Submitted before 21:00 Lagos Mon Oct 12

---

## Decision log

| Date | Decision | Why |
|---|---|---|
| 10-08 | Project: Riktha (Stellar account inheritance) over Tripwire | Finishable in 4 days; most Stellar-specific; original in the field |
| 10-08 | Two-phase design (Notice → Handover) per CAP-21 key-recovery pattern | False alarms cost one click |
| 10-08 | No custom Soroban contract | Protocol enforces everything; fewer failure points |
| 10-08 | Freighter only in MVP | Fewer moving parts |
| 10-08 | Neon + Drizzle; SMTP via Nodemailer; Telegram webhook; cron-job.org every minute | Vercel Hobby cron is daily only; no domain needed |
| 10-08 | Testnet only for submission | Unaudited |
| 10-08 | Phase 1/2 always submitted via fee-bump | Owner balance never blocks a claim |
| 10-08 | `SEQ_JUMP = 1e9` | SP1 passed |
| 10-08 | **Plain** Phase 2 is the default; sponsored is kept in the builders | SP4: always safe on reserves; the heir signs nothing; no Freighter PreconditionsV2 signing needed |
| 10-08 | Drop `reserveHealthy` / LOW_RESERVE; add `ownerCanPayFee` | SP4. If the owner can pay, Phase 1/2 can go inner-only with no fee-bump |
| 10-08 | REVOKED rule: neither hash present and S ≠ s1 (was: S < s1) | So a revoke after a cancelled claim shows as REVOKED |
| 10-08 | `buildEstateTransfer` can prepend a `ChangeTrust` for the heir | Non-XLM payments otherwise fail with `op_no_trust` |
| 10-08 | vitest 3.2.4 (not 5.x) | The vitest 5 rolldown native binary fails to load on Sam's Windows machine |
| 10-08 | Email via Gmail app password (Nodemailer SMTP) for now | No domain yet; Resend + own domain later if deliverability suffers |
| 10-09 | Heir notifications use the owner-provided heir email even if unverified | Otherwise heirs only hear about NOTICE/CLAIMABLE after signing up; the owner chose to share it |
| 10-09 | Keeper accepts `?only=<planId>` | Scripted test runs must not start claims on other people's plans |
| 10-09 | Lint rule `react-hooks/set-state-in-effect` off | It flags async fetch-on-mount (setState only after await) |
| 10-08 | SDK 17: always use `txHashHex()` / `memoText()` | `tx.hash()` and the memo value are `Uint8Array`, so `.toString("hex")` silently gives `"1,2,3…"` |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Spike fails (SP1/SP2) | Low | High | Fallbacks in A§2.2; Tripwire backup | Sam + Claude |
| Sponsored Phase 2 fails (SP3) | Medium | Low | Plain variant + reserve guard | |
| Freighter can't sign PreconditionsV2 (SP6) | Low | Medium | Plain variant needs no heir signature on inner tx | |
| Email lands in spam | Medium | Low | Show "check spam"; Telegram + dashboard as backups | |
| Testnet reset near judging | Low | Medium | Video already recorded; seed script | |
| Running out of time | Medium | High | Cut order above; internal deadline 21:00 | |
| Phase 1 included but fails at apply (CAP-21 re-checks minSeqAge) | Very low | Medium | CAP-21 forbids a lower-seq tx from the same account in the same set; the state shows BROKEN, so re-arm | |
| Owner activity that doesn't reset the clock (Soroban relayers, op-source only) | Medium | Medium | README honest limit; reminders + grace window | |

---

## Daily log

### 2026-10-09
- Built the rest: keeper + cron, notifications (dashboard/email/Telegram, deduped), dashboard, heir page, `/claim` (packet only), estate transfers, settings, re-arm, revoke, `/evidence`, landing page, README, seed-demo.
- `pnpm scenarios`: **10/10** on testnet. `pnpm test:lifecycle`: 25/25 (arm → keeper notice → claimable → handover → estate; re-arm; revoke). Unit tests 61/61.
- Fixed: keeper time budget started before the DB query (a cold Neon start meant nothing got processed).
- Accounts wired: Gmail SMTP, NEXT_PUBLIC_APP_URL, Telegram webhook + /status, cron-job.org every minute (test run 200). Live cancel → CANCELLED alert on all 3 channels. Gmail mail lands in spam (no own domain); content tweaked.
- Manual test passed end to end. Found: the session cookie outlives a Freighter account switch (Sam's plan went on the wrong account). Added a site-wide account-mismatch banner, and the wizard now names the account being protected.
- Decided: build the **heir claim kit** (heir named by email; key locked with a claim code in the owner's browser), then testnet anchor **cash-out** if time allows.

### 2026-10-08
- Chose Riktha; wrote PRD, ARCHITECTURE, PROGRESS.
- Next: T0.1 → T0.2 spike.
- Analysed the docs against CAP-21. Initialised the repo; moved the docs to `docs/`; scaffolded Next 16 + deps.
- Spike SP1–SP5 passed on testnet. Plain variant chosen; no reserve guard needed.
- `lib/core` complete (config, builders, state, packet, eligibility, errors, explain): 53 unit tests pass; tsc, lint and build are clean.
- `/dev/sign-test`: SP6 + SP7 passed in Sam's Freighter. **All spike checks green.**
- First commit; private GitHub repo created; Vercel linked; Neon schema pushed; @RikthaBot verified; secrets generated (`pnpm gen-secrets`) and copied to Vercel (`pnpm push-env`).
- Horizon client + SEP-10 sign-in (JWT cookie) + header ConnectButton; base design tokens per A§14.
- Plan API + `/plan/new` wizard + packet download. Email: Gmail app password for now (Resend + own domain later if spam is a problem).
- Found: **Avast HTTPS scanning** re-signs TLS. Node needs `NODE_EXTRA_CA_CERTS=…\Avast\wscert.pem` (set in Sam's user env). The Claude preview server didn't inherit it, so local servers run from a shell.

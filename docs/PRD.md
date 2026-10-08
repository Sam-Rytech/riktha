# Riktha — Product Requirements Document

> **Riktha** (Sanskrit: *inherited wealth; the estate left by the dead*).
> Inheritance for Stellar accounts, enforced by the Stellar protocol itself.
> No custodian, no seed-phrase sharing, no smart contract to trust.

| | |
|---|---|
| Hackathon | Find Your Way: Hackathon (Stellar Passport, road to HackMeridian) |
| Track | General Track |
| Deadline | **2026-10-12 23:59 UTC** (2026-10-13 00:59 Lagos) |
| Team | Solo (Sam, GitHub: Sam-Rytech) |
| Network | Stellar **Testnet** for the submission (mainnet disabled by config) |
| Status doc | `docs/PROGRESS.md` · Technical design: `docs/ARCHITECTURE.md` |

---

## 1. Problem

When a crypto holder dies or becomes permanently incapacitated without passing on their keys, the assets are lost forever. Nothing on-chain can tell the difference between "owner is gone" and "owner is quiet".

**Evidence (verifiable, cite in README and video):**
- Chainalysis-based estimates put **2.3–3.7 million BTC (≈11–18% of supply)** as permanently lost; Chainalysis classifies coins unmoved for 5+ years as likely lost because the owner no longer holds the keys. (Ledger Academy summary of Chainalysis; The Daily Hodl on the Chainalysis report.)
- Stellar now carries much more value than before: tokenized real-world assets on Stellar reached **≈$3.996B on 2026-08-29, up ~360% in 2026** (Cointelegraph, Stellar Dune dashboard). Almost none of it has an inheritance path.
- Existing inheritance products (Casa, Unchained, Liana, Nunchuk, Argent, Sarcophagus, Kresus) cover Bitcoin or EVM chains. A 2026 comparison of crypto estate tools lists **none for Stellar** (Spark, "Crypto Estate Planning Solutions Compared"). Pricing runs from free (Liana) to $2,100/yr (Casa Premium), which proves willingness to pay.

**Today's options on Stellar are all bad:**
1. Share the seed phrase with family → they can take everything *now*; one leak loses it all.
2. Write it in a will → lawyers, executors and probate staff see the seed; still a single point of leak.
3. Do nothing → the estate is lost.

## 2. Insight: the protocol already supports this

Stellar Protocol 19 (CAP-21) added **transaction preconditions**. CAP-21 itself contains a *"key recovery"* example and lists *"time-delayed key recovery"* as a goal:
- `minSeqAge`: a transaction is valid only after N seconds have passed since the account last changed its sequence number, i.e. since the owner last **sent** a transaction.
- `minSeqNum`: a transaction stays valid across a range of the owner's sequence numbers, so normal activity doesn't invalidate it.
- **Pre-authorized transaction signers** (`preauth_tx`): an account can authorize one exact future transaction by its hash, with no signature needed later.

Riktha turns this designed-in, unused capability into a product. **Nobody on Stellar has shipped it.**

## 3. Solution overview

The owner signs **one setup transaction**. It registers two pre-authorized future transactions:

| Phase | Valid when | Effect |
|---|---|---|
| **Phase 1: Notice** | Owner has sent nothing for the **inactivity window** (e.g. 180 days) | A no-op sequence bump. Its execution is the public "a claim has started" signal and restarts the clock. |
| **Phase 2: Handover** | **Grace window** (e.g. 30 days) has passed since Phase 1 **and** the owner has sent nothing since | Adds the heir as a signer on the owner's account. The heir can now move every asset, including Soroban positions authorized by the account. |

**Safety properties (all enforced by the protocol, not by Riktha):**
- **Any transaction the owner sends** before Phase 1 resets the inactivity clock. Nothing to remember, no check-in ritual.
- **Any transaction the owner sends after Phase 1** permanently kills Phase 2 (it consumes the exact sequence number Phase 2 needs). A false alarm costs one click.
- **Early submissions are harmless.** A transaction rejected for unmet preconditions never enters application, so its pre-auth signer stays on the account.
- **Riktha holds no keys.** The server stores only pre-signed transactions the network refuses until the conditions are met. A compromised server can only submit them early, and the network rejects that.
- **Riktha can disappear.** The heir holds an *inheritance packet* (a JSON file with both transactions) and can submit it with any Stellar tool (e.g. Stellar Lab's fee-bump tool).
- **Owner keeps control.** The owner's own key is never removed. Before handover the heir has no power at all.
- **Private until handover.** Before Phase 2 the chain shows only two opaque hash signers; the heir's address appears on-chain only at handover.

## 4. Users

| Persona | Description | Main need |
|---|---|---|
| **Owner** | Holds XLM, USDC or RWA tokens in a self-custodied Stellar account (Freighter). Not necessarily technical. | Make sure family can inherit without handing over the seed today. |
| **Heir** | Family member or trusted person with their own funded Stellar account. | Know a plan exists, be told when to act, claim and move the assets simply. |
| **Riktha operator** | Runs the hosted app, keeper and notifications. | Never able to touch funds; minimal liability. |

## 5. Goals and non-goals

**Goals (hackathon MVP)**
1. An owner can create, check, re-arm, edit and revoke an inheritance plan with one wallet signature per action.
2. An heir can complete the full claim on testnet: Phase 1 (if the keeper hasn't), Phase 2, then move assets.
3. Reminders via **email, Telegram and the dashboard**, before the switch fires and at every state change.
4. A claim works **without Riktha's database** (packet-only claim page).
5. Every claim in the pitch is backed by a public testnet transaction on an evidence page.

**Non-goals (stated honestly in README)**
- Not a legal will; it does not replace probate or estate law (Nigerian or otherwise). Positioning: the technical half that pairs with a will.
- No custom Soroban contract: the protocol does the work. (Soroban positions *are* covered, because Soroban authorizes classic accounts through their signers.)
- No multisig/custom-threshold owner accounts, multiple heirs, or hardware wallets in the MVP.
- No mainnet in the submission.

## 6. User stories and acceptance criteria

### Owner
| ID | Story | Acceptance criteria |
|---|---|---|
| O1 | Connect Freighter and sign in | Sign-in via a SEP-10-style challenge signed in Freighter; session cookie issued. |
| O2 | Create a plan | Enter heir address (must be a funded account), choose windows (presets: 90 / 180 / 365 days inactivity, 30 days grace; **Demo**: 2 min / 2 min on testnet), optional heir email. App shows a plain-language review of all 3 transactions before signing. |
| O3 | Sign setup once | One Freighter signature. After submission the server verifies on-chain that both pre-auth signers with the expected hashes exist before marking the plan **Armed**. |
| O4 | Download the packet | Packet JSON downloadable at any time; emailed to the heir if an email was given. |
| O5 | See status | Dashboard shows state, countdown to Phase 1 eligibility (from Horizon `sequence_time`), last activity, heir (masked), windows, reserve health. |
| O6 | "I'm alive" | One-click check-in (a no-op bump-sequence transaction) resets the clock. Explains that **any** sent transaction also counts, and that **received** payments do not. |
| O7 | Cancel a started claim | If Phase 1 has executed, a red banner with a one-click cancel. After cancel, the plan shows **Cancelled — re-arm needed**. |
| O8 | Re-arm / edit / revoke | One transaction removes stale pre-auth signers and (for re-arm/edit) adds a new pair. Revoke removes all Riktha signers. |
| O9 | Notifications | Link email (verified by link) and Telegram (deep-link /start). Receive the reminders listed in §8. |

### Heir
| ID | Story | Acceptance criteria |
|---|---|---|
| H1 | Know a plan names me | Invite email with the packet attached; after sign-in, "Plans naming me" lists them. |
| H2 | Follow the countdown | Heir view shows state and expected dates, but no owner balances before handover. |
| H3 | Start the claim | When eligible, "Start claim" submits Phase 1 wrapped in a fee-bump the heir pays. (The keeper normally does this automatically.) |
| H4 | Complete handover | When claimable, "Complete handover" signs (if required) and submits Phase 2 in a fee-bump. |
| H5 | Move the estate | After handover: list of the owner account's balances, and "Send to me" per asset, signed by the heir's own key (tx source = heir, op source = owner). |
| H6 | Claim without Riktha's DB | `/claim`: upload the packet, the state is derived purely from chain, submit Phase 1/2. |

### System
| ID | Story | Acceptance criteria |
|---|---|---|
| S1 | Keeper | Every minute: derive each plan's state from Horizon, persist it, send due notifications, auto-submit Phase 1 when eligible (fee paid by the keeper account). |
| S2 | Idempotent notifications | Each notification sends at most once per (plan, kind, cycle). |
| S3 | Evidence | `/evidence` lists testnet transaction links for every scenario in the test plan. |

## 7. Core flows

```
Owner                              Riktha                         Stellar testnet
  | create plan (heir, windows) ---> | build Phase1, Phase2, Setup  |
  | <--- review (decoded txs) -------|                              |
  | sign Setup in Freighter -------------------------------------->| 2 preauth signers added
  | ---- confirm(hash) ------------->| verify signers on chain      |
  |                                  | email packet to heir         |
  ... owner keeps using the account; every sent tx resets the clock ...
  |                                  | keeper: 50/80/95% reminders  |
  |                                  | inactivity reached:          |
  |                                  |   fee-bump(Phase1) -------->| seq = s1 (Notice)
  | <-- URGENT: claim started -------|--> heir: claim started      |
  | (alive?) any tx  ---------------------------------------------->| Phase2 dead → Cancelled
  |                                  | grace reached → heir alert   |
Heir: Complete handover → fee-bump(Phase2) ----------------------->| heir becomes signer
Heir: Send assets to me (heir-signed) ---------------------------->| estate moved
```

## 8. Notifications matrix

Channels: **dashboard** (always), **email** (if verified), **Telegram** (if linked).

| Trigger | Owner | Heir |
|---|---|---|
| Plan armed | Confirmation + packet link | Invite + packet attachment (if email given) |
| 50% / 80% / 95% of inactivity elapsed | "Check in: send any transaction or press I'm alive" | — |
| Phase 1 executed (Notice) | **URGENT** "A claim on your account has started. Send any transaction before {date} to cancel." | "The owner's inactivity window passed. Handover possible from {date} unless the owner responds." |
| 50% / 90% of grace elapsed | URGENT repeat | — |
| Claimable (grace passed) | — | "You can complete the handover now." |
| Inherited | Informational | "Handover complete. Move the assets." |
| Cancelled | "Claim cancelled. Re-arm your plan." | "The owner responded; the claim was cancelled." |

Reminder cycles reset whenever the owner's `sequence_time` changes.

## 9. Non-functional requirements

- **Security:** no private keys of users on the server. Server secrets: SEP-10 signing key, keeper fee account (low balance), JWT, SMTP, Telegram, cron secret. All endpoints authenticated or secret-protected; all on-chain claims re-verified server-side.
- **Privacy:** heir identity off-chain until handover; contact data only in the DB; the packet reveals the owner↔heir link, which is acceptable since it is held by the heir.
- **Reliability:** the chain is the source of truth; the DB is a cache plus contact book. The keeper is idempotent. The claim works without the DB.
- **Usability:** grade-8 language, no jargon on main screens ("check in", "handover"), technical details in expandable "What exactly will be signed?" panels.
- **Accessibility:** keyboard navigable, contrast AA, no color-only states.

## 10. Hackathon alignment

**Submission requirements (from the hackathon's submission form)**

| Field | Riktha |
|---|---|
| Project name | Riktha |
| Description | From README summary (§3) |
| Track | General Track (University Track is limited to students enrolled in Chile) |
| Email | Sam's email |
| Repo (must be open source) | `github.com/Sam-Rytech/riktha`, MIT license |
| Video pitch (3 min max) | Planned together; demo uses 2-minute testnet windows |
| Other links | Live app (Vercel), evidence page |
| T&Cs checkbox | Tick |
| Registration | GitHub profile |

**Judging criteria (General Track):** technical execution, meaningful use of Stellar, originality, potential impact, user experience, presentation quality.

| Criterion | How Riktha scores |
|---|---|
| Technical execution | Protocol-level design, unit-tested builders, scripted scenario runs with tx links |
| Meaningful use of Stellar | CAP-21 preconditions, pre-auth signers, fee-bump, sponsored reserves, SEP-10-style auth. Impossible to port as-is to most chains. |
| Originality | No other submission (38 reviewed on 2026-10-06) or known Stellar product does this |
| Potential impact | ~$4B of RWAs on Stellar with no inheritance path; universal problem |
| User experience | One signature to set up; zero rituals; plain-language review |
| Presentation | Emotional hook + live countdown on testnet |

## 11. Success metrics (for the demo)

- All 10 scenarios in ARCHITECTURE §11 pass on testnet with public tx hashes.
- Owner setup ≤ 2 minutes, heir claim ≤ 2 minutes (excluding windows).
- Reminders delivered on all three channels in the recorded demo.

## 12. Honest limits (put in README)

1. **Not a legal will.** Heirs may still need probate.
2. **"Sent" transactions only.** Receiving payments does not reset the clock. Neither does activity where the owner is not the transaction source, e.g. a Soroban app that sends the owner's signed auth entry through a relayer. An owner who never sends anything for the whole window triggers Phase 1; that's what the grace window and alerts are for.
3. **Classic accounts only.** Smart-wallet (C-address) balances aren't covered unless they authorize via the G account.
4. **Standard accounts only** in the MVP (master key, no other signers).
5. **The heir key is a single point.** If the heir loses their key, re-plan while the owner is alive.
6. **Testnet only**, unaudited.
7. **The estate screen lists classic balances** (XLM + trustline assets). Soroban token positions are controllable by the heir but are not listed in the UI.

## 13. Roadmap (post-hackathon)

Multiple heirs with weights (e.g. any 2 of 3 children); staged release (a share per heir); wallet SDK so Freighter/Lobstr/xBull can offer "Set up inheritance" natively; anchor and RWA-issuer integrations; mainnet with an audit; hardware-wallet support; optional legal partner network; SCF grant application.

## 14. Sources

- CAP-21 Generalized transaction preconditions: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md
- CAP-28 Pre-auth signer removal: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0028.md
- Stellar docs, signatures & multisig: https://developers.stellar.org/docs/learn/fundamentals/transactions/signatures-multisig
- Stellar docs, operations & transactions: https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions
- Stellar docs, authorization (Soroban, classic accounts at medium threshold): https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization
- Ledger Academy, lost Bitcoin: https://ledger.com/academy/topics/economics-and-regulation/how-many-bitcoin-are-lost-ledger
- Cointelegraph, Stellar RWA market: https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth
- Spark, crypto estate planning comparison: https://www.spark.money/tools/crypto-estate-planning-comparison
- Cointelegraph, lawyer on dead man's switches: https://cointelegraph.com/interview/lawyer-says-dead-mans-switch-not-best-option-for-digital-asset-inheritance

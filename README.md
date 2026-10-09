# Riktha

**Inheritance for Stellar accounts, enforced by the Stellar protocol itself.**
No custodian, no seed-phrase sharing, no smart contract to trust.

*Riktha* (Sanskrit): inherited wealth; the estate left by the dead.

- **Live app:** https://riktha.vercel.app (Stellar testnet)
- **Evidence:** every protocol claim below, backed by a public testnet transaction, at [`/evidence`](https://riktha.vercel.app/evidence) ([data](docs/evidence.json))
- Built for *Find Your Way: Hackathon* (Stellar Passport, road to HackMeridian), General Track

## The problem

When a crypto holder dies without passing on their keys, the assets are gone: chain data can't tell "the owner is gone" from "the owner is quiet". Chainalysis-based estimates put 2.3–3.7 million BTC as permanently lost. Tokenized real-world assets on Stellar passed **$3.9B** in 2026, and none of the existing inheritance products (Casa, Unchained, Liana, Nunchuk, Sarcophagus…) supports Stellar. Today a Stellar holder can share the seed phrase (and risk a leak), put it in a will (and show it to everyone who reads it), or lose everything.

## How it works

The owner signs **one setup transaction**. It registers two **pre-authorized transactions** (`preauth_tx` signers) on their own account, each guarded by [CAP-21](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md) preconditions:

| Phase | Valid when | Effect |
|---|---|---|
| **1. Notice** | the owner has **sent** nothing for the inactivity window (`minSeqAge = I`, `minSeqNum = X`) | a no-op `BumpSequence` to sequence `s1`: the public "a claim has started" signal |
| **2. Handover** | the grace window has passed since the notice **and** the owner has sent nothing since (`minSeqAge = G`, sequence must be exactly `s1`) | `SetOptions` adds the heir as a signer; the heir can now move every asset |

```
owner signs setup ──► 2 preauth signers on the owner's account
   … any tx the owner sends resets the clock (seqTime) …
inactivity window passes ──► keeper (or anyone) submits Notice, fee-bumped ──► owner alerted on 3 channels
   … any tx from the owner now consumes s1+1 and kills the Handover forever …
grace window passes ──► heir submits Handover, fee-bumped ──► heir is a signer ──► heir moves assets
```

**Why it's safe (all enforced by validators, not by Riktha):**
- **Riktha holds no keys.** The server stores only pre-signed transactions the network refuses until their conditions hold. A compromised server can only submit them early, and the network rejects that.
- **Early submissions are harmless.** A transaction rejected for unmet preconditions never reaches application, so its pre-auth signer stays in place (CAP-28).
- **One click cancels.** After a notice, any transaction from the owner uses up the exact sequence number the handover needs.
- **Riktha can disappear.** The heir holds an *inheritance packet* (both transactions as JSON) and can claim at [`/claim`](https://riktha.vercel.app/claim) (no login, no database) or with any Stellar tool.
- **Private until handover.** Before phase 2 the ledger shows only two opaque hash signers.
- **The owner keeps control.** Their key is never removed.

### Why Stellar

This design is only possible because Stellar has, at protocol level, transaction preconditions (`minSeqAge`, `minSeqNum`; Protocol 19), pre-authorized transaction signers, fee-bump transactions, and Soroban auth that goes through classic signers. CAP-21 itself lists *time-delayed key recovery* as a goal. Riktha turns that designed-in, unused capability into a product. It doesn't port as-is to most chains.

### Protocol findings from our spike (`pnpm spike`, results in `docs/PROGRESS.md`)

- A sequence jump of 1e9 for phase 1 is accepted.
- `sequence_time` is **absent** on fresh accounts until their first V3-extension update (setup provides it).
- **No reserve guard is needed for the plain handover.** Phase 1 removes its own pre-auth signer, which frees one base reserve before phase 2 can run. The owner can't spend that reserve without cancelling the claim.
- Phase transactions also work **without** a fee-bump: the pre-auth signer authorizes them and the owner's account pays the 100-stroop fee.
- Freighter signs both PreconditionsV2 transactions and fee-bump envelopes.
- SDK 17 returns `Uint8Array` from `tx.hash()` and text memos. `.toString("hex")` silently produces `"1,2,3…"`, so we use explicit helpers (`txHashHex`, `memoText`).

## Architecture

```
Browser (Next.js)            lib/core: builders, state machine, packet  ◄── same code on the server
  Freighter signs ──────────► Horizon (user txs go straight to the network)
        │ /api/*
Vercel (Next.js routes) ── Neon Postgres (cache + contacts; the chain is the source of truth)
  /api/cron/tick ◄── cron-job.org every minute: derive state → notify → auto-submit Notice
  notifications ──► dashboard · email (SMTP) · Telegram bot
```

- **The chain is the source of truth.** Plan state is always *derived* from the owner's Horizon account (`lib/core/state.ts`); the DB only caches it.
- **One pure, isomorphic, unit-tested module** builds every transaction (`lib/core`).
- **Sign-in** is a SEP-10-style challenge signed in Freighter → JWT in an httpOnly cookie.
- **Keeper** is idempotent: notifications are deduplicated by a unique index per (plan, kind, cycle, recipient, channel).

Full specs: [`docs/PRD.md`](docs/PRD.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · progress log [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Run it locally

Requires Node 22+, pnpm, the [Freighter](https://freighter.app) extension set to **Testnet**, and a free [Neon](https://neon.tech) Postgres database.

```bash
pnpm install
cp .env.example .env.local     # add DATABASE_URL (Neon) and, optionally, SMTP + Telegram values
pnpm gen-secrets               # fills JWT/cron/webhook secrets, a SEP-10 key and a funded testnet keeper
pnpm db:push                   # creates the tables
pnpm dev                       # http://localhost:3000
```

Try it with fresh demo accounts: `pnpm seed-demo` creates a funded owner (holding XLM and a test asset) and a funded heir, and saves their secret keys to `demo-accounts.local.json` (git-ignored) for importing into Freighter. Choose the **Demo** preset (2-minute windows) when creating a plan. To run the keeper locally, call it with your cron secret:

```bash
curl -X POST http://localhost:3000/api/cron/tick -H "Authorization: Bearer $CRON_SECRET"
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_NETWORK` | `testnet` (mainnet is disabled) |
| `NEXT_PUBLIC_APP_URL` | links in emails and Telegram messages |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon Postgres |
| `JWT_SECRET` | session cookies |
| `SEP10_SIGNING_SECRET` | server key that signs sign-in challenges (no funds needed) |
| `KEEPER_SECRET` | funded testnet account that pays Notice fee-bumps |
| `CRON_SECRET` | bearer secret for `/api/cron/tick` |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `MAIL_FROM` | email (e.g. a Gmail app password) |
| `TELEGRAM_BOT_TOKEN` `TELEGRAM_BOT_USERNAME` `TELEGRAM_WEBHOOK_SECRET` | Telegram alerts |

## Tests

```bash
pnpm test             # unit tests: builders, state machine, packet, errors, eligibility, notifications
pnpm scenarios        # the 10 protocol scenarios on live testnet → docs/evidence.json
pnpm test:auth        # sign-in e2e against a running app
pnpm test:plans       # plan API e2e on testnet
pnpm test:lifecycle   # arm → keeper notice → handover → estate, plus re-arm and revoke
```

## Deploying

1. Import the repo into Vercel and add Neon from the Vercel Marketplace.
2. `pnpm db:push`, then copy secrets with `pnpm push-env`.
3. Point Telegram at the webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`.
4. cron-job.org: `POST <APP_URL>/api/cron/tick` every minute with `Authorization: Bearer <CRON_SECRET>`. Vercel Hobby cron runs only daily, so `vercel.json` keeps a daily run as a backup.

## Honest limits

1. **Not a legal will.** Heirs may still need probate; Riktha is the technical half that pairs with a will.
2. **Only sent transactions count.** Receiving payments doesn't reset the clock, and neither does activity where the owner isn't the transaction source (e.g. a Soroban app relaying the owner's auth entry). The grace window and alerts exist for exactly this.
3. **Classic, standard accounts only:** a master key and no other signers. Smart-wallet (C-address) balances aren't covered unless they authorize through the G account. The estate screen lists classic balances only.
4. **The heir's key is a single point of failure.** If the heir loses it, re-plan while the owner is alive.
5. **Testnet only, unaudited.**

## Roadmap

Multiple heirs with weights; staged release; a wallet SDK so Freighter/Lobstr/xBull can offer "Set up inheritance" natively; anchor and RWA-issuer integrations; hardware wallets; mainnet after an audit.

## License

[MIT](LICENSE)

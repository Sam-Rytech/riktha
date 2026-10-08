// Appends any missing server secrets to .env.local without printing them.
// Run: node scripts/gen-secrets.mjs   (creates and friendbot-funds a testnet keeper account)
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { Keypair } from "@stellar/stellar-sdk";

const file = ".env.local";
const cur = existsSync(file) ? readFileSync(file, "utf8") : "";
const has = (k) => new RegExp(`^${k}=`, "m").test(cur);
const rand = () => randomBytes(32).toString("base64url");

const vals = {
  NEXT_PUBLIC_NETWORK: () => "testnet",
  NEXT_PUBLIC_APP_URL: () => "http://localhost:3000",
  JWT_SECRET: rand,
  CRON_SECRET: rand,
  TELEGRAM_WEBHOOK_SECRET: rand,
  SEP10_SIGNING_SECRET: () => Keypair.random().secret(),
  KEEPER_SECRET: () => {
    const kp = Keypair.random();
    fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
      .then((r) => console.log(`keeper ${kp.publicKey()} friendbot: ${r.status}`))
      .catch((e) => console.log(`keeper ${kp.publicKey()} friendbot failed (${e.message}); fund it manually`));
    return kp.secret();
  },
};

const missing = Object.keys(vals).filter((k) => !has(k));
if (missing.length) {
  appendFileSync(file, `\n# Riktha secrets (generated)\n${missing.map((k) => `${k}=${vals[k]()}`).join("\n")}\n`);
}
console.log(missing.length ? `added: ${missing.join(", ")}` : "nothing to add");

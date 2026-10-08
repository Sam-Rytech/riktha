// Copies server secrets from .env.local to Vercel (production + preview) without printing them.
// Run from the project root in any shell: node scripts/push-env.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const KEYS = [
  "NEXT_PUBLIC_NETWORK", "JWT_SECRET", "CRON_SECRET", "SEP10_SIGNING_SECRET", "KEEPER_SECRET",
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME", "TELEGRAM_WEBHOOK_SECRET",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM",
];
const ENVS = ["production", "preview"];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"(.*)"$/, "$1")]; }),
);

for (const k of KEYS) {
  if (!env[k]) { console.log(`skip ${k} (not in .env.local)`); continue; }
  for (const e of ENVS) {
    try {
      execFileSync("vercel", ["env", "add", k, e, "--force"], { input: env[k], stdio: ["pipe", "ignore", "pipe"], shell: process.platform === "win32" });
      console.log(`ok   ${k} → ${e}`);
    } catch (err) {
      console.log(`FAIL ${k} → ${e}: ${String(err.stderr ?? err.message).split("\n").find(Boolean)}`);
    }
  }
}

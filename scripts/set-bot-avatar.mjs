// Set @RikthaBot's profile photo via the Bot API (setMyProfilePhoto). Reads TELEGRAM_BOT_TOKEN from .env.local.
// Run: node scripts/set-bot-avatar.mjs [path/to/photo.jpg]   (default: public/brand/riktha-avatar.jpg)
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set in .env.local");
const file = process.argv[2] ?? "public/brand/riktha-avatar.jpg";

const form = new FormData();
form.append("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }));
form.append("avatar", new Blob([readFileSync(file)], { type: "image/jpeg" }), "avatar.jpg");

const res = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: "POST", body: form });
const body = await res.json();
if (!body.ok) throw new Error(`Telegram refused the photo: ${body.description}`);
console.log(`Profile photo set from ${file}`);

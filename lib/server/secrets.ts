import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison for shared secrets (cron, Telegram webhook). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

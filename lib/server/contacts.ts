import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { emailEnabled, sendEmail } from "./notify/email";
import { appUrl } from "./notify";
import { toEmail } from "./notify/templates";
import { botUsername, telegramEnabled } from "./notify/telegram";
import { PlanError } from "./plans";

const { contacts, telegramLinks } = schema;
const token = () => randomBytes(24).toString("base64url");
const LINK_MINUTES = 15;

export async function getContact(address: string) {
  const [c] = await db().select().from(contacts).where(eq(contacts.address, address)).limit(1);
  return {
    email: c?.email ?? null,
    emailVerified: c?.emailVerified ?? false,
    telegramLinked: !!c?.telegramChatId,
    channels: { email: emailEnabled(), telegram: telegramEnabled() },
    telegramBot: botUsername(),
  };
}

/** Stores the email unverified and sends a verification link. `null` removes it. */
export async function setEmail(address: string, email: string | null) {
  if (email === null) {
    await db().insert(contacts).values({ address }).onConflictDoUpdate({ target: contacts.address, set: { email: null, emailVerified: false, emailToken: null } });
    return getContact(address);
  }
  if (!emailEnabled()) throw new PlanError("Email isn't configured on this server yet.", 503);
  const t = token();
  await db().insert(contacts).values({ address, email, emailVerified: false, emailToken: t })
    .onConflictDoUpdate({ target: contacts.address, set: { email, emailVerified: false, emailToken: t } });
  const link = `${appUrl()}/api/contacts/verify?token=${t}`;
  const ok = await sendEmail(email, toEmail({
    title: "Confirm your email for Riktha",
    body: "Confirm this address to receive reminders before your inactivity window ends, and an alert if a claim ever starts. If you didn't ask for this, ignore this email.",
    cta: { label: "Confirm email", url: link },
  }, false, "someone entered this address in Riktha's settings; if that wasn't you, ignore this email"));
  if (!ok) throw new PlanError("We couldn't send the verification email. Check the address and try again.", 502);
  return getContact(address);
}

export async function verifyEmailToken(t: string): Promise<boolean> {
  if (!t || t.length > 64) return false;
  const rows = await db().update(contacts).set({ emailVerified: true, emailToken: null })
    .where(eq(contacts.emailToken, t)).returning({ address: contacts.address });
  return rows.length > 0;
}

export async function createTelegramLink(address: string) {
  if (!telegramEnabled()) throw new PlanError("Telegram isn't configured on this server yet.", 503);
  const t = token();
  await db().insert(telegramLinks).values({ token: t, address, expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000) });
  return { url: `https://t.me/${botUsername()}?start=${t}` };
}

export async function unlinkTelegram(address: string) {
  await db().update(contacts).set({ telegramChatId: null }).where(eq(contacts.address, address));
  return getContact(address);
}

/** Consumes a /start token; returns the linked address or null. */
export async function redeemTelegramToken(t: string, chatId: string): Promise<string | null> {
  const [link] = await db().delete(telegramLinks)
    .where(and(eq(telegramLinks.token, t), gte(telegramLinks.expiresAt, sql`now()`)))
    .returning({ address: telegramLinks.address });
  if (!link) return null;
  await db().insert(contacts).values({ address: link.address, telegramChatId: chatId })
    .onConflictDoUpdate({ target: contacts.address, set: { telegramChatId: chatId } });
  return link.address;
}

export async function addressForChat(chatId: string): Promise<string | null> {
  const [c] = await db().select({ address: contacts.address }).from(contacts).where(eq(contacts.telegramChatId, chatId)).limit(1);
  return c?.address ?? null;
}

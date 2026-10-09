import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { type Due, URGENT } from "@/lib/core/notifications";
import { db, schema } from "../db";
import type { Plan } from "../db/schema";
import { packetFilename, packetFromRow } from "../packet";
import { sendEmail, type Attachment } from "./email";
import { render, toEmail, toTelegram } from "./templates";
import { sendTelegram } from "./telegram";

const { notifications, contacts } = schema;

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Claims a (plan, kind, cycle, recipient, channel) slot. True only for the first caller. */
async function claim(plan: Plan, due: Due, recipient: string, channel: string, extra: { title?: string; body?: string; urgent?: boolean } = {}) {
  const rows = await db().insert(notifications)
    .values({ planId: plan.id, kind: due.kind, cycle: due.cycle, recipient, channel, ...extra })
    .onConflictDoNothing().returning({ id: notifications.id });
  return rows[0]?.id as string | undefined;
}
const release = (id: string) => db().delete(notifications).where(eq(notifications.id, id));

/**
 * Dashboard always; email if verified (heir: the owner-provided address counts, PRD O2/H1);
 * Telegram if linked. Each channel is deduplicated independently; a failed send is released for retry.
 */
export async function dispatch(plan: Plan, due: Due, times: { eligibleAt?: number; claimableAt?: number }): Promise<number> {
  const recipient = due.to === "owner" ? plan.ownerAddress : plan.heirAddress;
  const msg = render(due.kind, {
    appUrl: appUrl(), owner: plan.ownerAddress, heir: plan.heirAddress,
    inactivitySeconds: plan.inactivitySecs, graceSeconds: plan.graceSecs, ...times,
    heirKind: plan.heirKind as "wallet" | "kit", planId: plan.id,
  });
  const urgent = URGENT.has(due.kind);
  let sent = 0;

  if (await claim(plan, due, recipient, "dashboard", { title: msg.title, body: msg.body, urgent })) sent++;

  const [contact] = await db().select().from(contacts).where(eq(contacts.address, recipient)).limit(1);
  const email = contact?.emailVerified && contact.email ? contact.email : due.to === "heir" ? plan.heirEmail : null;
  if (email) {
    const id = await claim(plan, due, recipient, "email");
    if (id) {
      const attachments: Attachment[] = due.kind === "ARMED_HEIR"
        ? [{ filename: packetFilename(plan), content: JSON.stringify(packetFromRow(plan), null, 2), contentType: "application/json" }]
        : [];
      const reason = contact?.emailVerified && contact.email === email
        ? "you added this address in your Riktha settings"
        : "the owner of a Stellar account named you as their heir and gave this address";
      if (await sendEmail(email, toEmail(msg, urgent, reason), attachments)) sent++;
      else await release(id);
    }
  }
  if (contact?.telegramChatId) {
    const id = await claim(plan, due, recipient, "telegram");
    if (id) {
      if (await sendTelegram(contact.telegramChatId, toTelegram(msg, urgent))) sent++;
      else await release(id);
    }
  }
  return sent;
}

export async function dispatchAll(plan: Plan, dues: Due[], times: { eligibleAt?: number; claimableAt?: number }) {
  let n = 0;
  for (const d of dues) {
    try { n += await dispatch(plan, d, times); } catch (e) { console.error("dispatch failed", d.kind, (e as Error).message); }
  }
  return n;
}

export async function inbox(address: string, limit = 30) {
  return db().select({
    id: notifications.id, planId: notifications.planId, kind: notifications.kind, title: notifications.title,
    body: notifications.body, urgent: notifications.urgent, sentAt: notifications.sentAt, readAt: notifications.readAt,
  }).from(notifications)
    .where(and(eq(notifications.recipient, address), eq(notifications.channel, "dashboard")))
    .orderBy(desc(notifications.sentAt)).limit(limit);
}

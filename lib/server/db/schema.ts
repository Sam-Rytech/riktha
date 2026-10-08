// A§6. The chain is the source of truth; these tables cache derived state and hold contacts.
import { sql } from "drizzle-orm";
import {
  bigint, boolean, check, index, integer, numeric, pgTable, text, timestamp, unique, uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  network: text("network").notNull(),
  ownerAddress: text("owner_address").notNull(),
  heirAddress: text("heir_address").notNull(),
  heirEmail: text("heir_email"),
  variant: text("variant").notNull(),
  weight: integer("weight").notNull(),
  inactivitySecs: bigint("inactivity_secs", { mode: "number" }).notNull(),
  graceSecs: bigint("grace_secs", { mode: "number" }).notNull(),
  baseSeq: numeric("base_seq", { precision: 20, scale: 0 }).notNull(),     // X
  phase1Seq: numeric("phase1_seq", { precision: 20, scale: 0 }).notNull(), // s1
  phase2Seq: numeric("phase2_seq", { precision: 20, scale: 0 }).notNull(), // s2
  phase1Hash: text("phase1_hash").notNull(),
  phase2Hash: text("phase2_hash").notNull(),
  phase1Xdr: text("phase1_xdr").notNull(),
  phase2Xdr: text("phase2_xdr").notNull(),
  setupXdr: text("setup_xdr").notNull(),
  setupTxHash: text("setup_tx_hash"),
  status: text("status").notNull().default("DRAFT"),
  lastSeqTime: bigint("last_seq_time", { mode: "number" }),
  autoStartClaim: boolean("auto_start_claim").notNull().default(true),
  version: integer("version").notNull().default(1),
  supersededBy: uuid("superseded_by").references((): AnyPgColumn => plans.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("plans_network_check", sql`${t.network} in ('testnet','mainnet')`),
  check("plans_variant_check", sql`${t.variant} in ('sponsored','plain')`),
  index("plans_owner_idx").on(t.ownerAddress),
  index("plans_heir_idx").on(t.heirAddress),
  index("plans_active_status_idx").on(t.status).where(sql`${t.supersededBy} is null`),
]);

export const contacts = pgTable("contacts", {
  address: text("address").primaryKey(),
  email: text("email"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailToken: text("email_token"),
  telegramChatId: text("telegram_chat_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const telegramLinks = pgTable("telegram_links", {
  token: text("token").primaryKey(),
  address: text("address").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  kind: text("kind").notNull(),
  cycle: bigint("cycle", { mode: "number" }).notNull(),
  recipient: text("recipient").notNull(),
  channel: text("channel").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("notifications_dedupe").on(t.planId, t.kind, t.cycle, t.recipient, t.channel),
]);

export const planEvents = pgTable("plan_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  type: text("type").notNull(),
  txHash: text("tx_hash"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

import "server-only";
import { and, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { buildPlan, parseTx, txHashHex, Variant } from "@/lib/core/builders";
import { NetworkName } from "@/lib/core/config";
import { checkHeirAccount, checkOwnerAccount, checkWindows } from "@/lib/core/eligibility";
import { explainTx } from "@/lib/core/explain";
import { makePacket } from "@/lib/core/packet";
import { derivePlanState, PlanOnChainRef } from "@/lib/core/state";
import { baseReserveStroops, loadAccountRaw } from "@/lib/stellar/horizon";
import type { Session } from "./auth";
import { db, schema } from "./db";
import type { Plan } from "./db/schema";

const { plans, planEvents } = schema;
const DEFAULT_VARIANT: Variant = "plain"; // spike SP4
const PLAN_CREATES_PER_HOUR = 10;

export class PlanError extends Error {
  constructor(message: string, readonly status = 400, readonly details: string[] = []) { super(message); }
}

export function toRef(p: Plan): PlanOnChainRef {
  return {
    heir: p.heirAddress, variant: p.variant as Variant, baseSeq: BigInt(p.baseSeq), phase1Seq: BigInt(p.phase1Seq),
    phase1Hash: p.phase1Hash, phase2Hash: p.phase2Hash, inactivitySeconds: p.inactivitySecs, graceSeconds: p.graceSecs,
  };
}

/** Loads a plan the session may see: as owner, or (if allowed) as heir. */
export async function loadPlanFor(id: string, s: Session, roles: ("owner" | "heir")[] = ["owner"]): Promise<{ plan: Plan; role: "owner" | "heir" }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PlanError("Plan not found", 404);
  const [plan] = await db().select().from(plans).where(eq(plans.id, id)).limit(1);
  if (!plan || plan.network !== s.network) throw new PlanError("Plan not found", 404);
  if (roles.includes("owner") && plan.ownerAddress === s.address) return { plan, role: "owner" };
  if (roles.includes("heir") && plan.heirAddress === s.address) return { plan, role: "heir" };
  throw new PlanError("Plan not found", 404);
}

/** Every pre-auth hash Riktha ever registered for this owner (so re-arm can remove stale ones). */
async function knownHashes(owner: string, network: NetworkName): Promise<string[]> {
  const rows = await db().select({ h1: plans.phase1Hash, h2: plans.phase2Hash }).from(plans)
    .where(and(eq(plans.ownerAddress, owner), eq(plans.network, network)));
  return rows.flatMap((r) => [r.h1, r.h2]);
}

export interface DraftInput { heir: string; inactivitySeconds: number; graceSeconds: number; heirEmail?: string | null }

/** Validates everything against the chain, builds the 3 transactions and stores a DRAFT. */
export async function createDraft(s: Session, input: DraftInput, previous?: Plan) {
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(plans)
    .where(and(eq(plans.ownerAddress, s.address), gte(plans.createdAt, sql`now() - interval '1 hour'`)));
  if (n >= PLAN_CREATES_PER_HOUR) throw new PlanError("Too many plans created in the last hour. Try again later.", 429);

  const [owner, heir, reserve, known] = await Promise.all([
    loadAccountRaw(s.network, s.address), loadAccountRaw(s.network, input.heir),
    baseReserveStroops(s.network), knownHashes(s.address, s.network),
  ]);
  const ownerCheck = checkOwnerAccount(owner, reserve, known);
  const errors = [...checkWindows(s.network, input.inactivitySeconds, input.graceSeconds), ...checkHeirAccount(input.heir, s.address, heir), ...ownerCheck.errors];
  if (errors.length) throw new PlanError(errors[0], 400, errors);

  const built = buildPlan({
    network: s.network, owner: s.address, heir: input.heir,
    inactivitySeconds: input.inactivitySeconds, graceSeconds: input.graceSeconds,
    variant: DEFAULT_VARIANT, weight: ownerCheck.weight,
    currentSeq: BigInt(owner!.sequence), stalePreauthHashes: ownerCheck.stalePreauthHashes,
  });

  const [row] = await db().insert(plans).values({
    network: s.network, ownerAddress: s.address, heirAddress: input.heir, heirEmail: input.heirEmail || null,
    variant: DEFAULT_VARIANT, weight: ownerCheck.weight,
    inactivitySecs: input.inactivitySeconds, graceSecs: input.graceSeconds,
    baseSeq: built.baseSeq.toString(), phase1Seq: built.phase1Seq.toString(), phase2Seq: built.phase2Seq.toString(),
    phase1Hash: built.phase1Hash, phase2Hash: built.phase2Hash,
    phase1Xdr: built.phase1.toXDR(), phase2Xdr: built.phase2.toXDR(), setupXdr: built.setup.toXDR(),
    version: (previous?.version ?? 0) + 1,
  }).returning();

  const names = { [s.address]: "your account", [input.heir]: "your heir" };
  return {
    planId: row.id,
    setupXdr: row.setupXdr, phase1Xdr: row.phase1Xdr, phase2Xdr: row.phase2Xdr,
    explain: { setup: explainTx(built.setup, names), phase1: explainTx(built.phase1, names), phase2: explainTx(built.phase2, names) },
    removesStaleSigners: ownerCheck.stalePreauthHashes.length,
  };
}

/** Confirms a submitted setup tx: it must be this plan's setup, succeeded, and both signers must be on chain. */
export async function confirmSetup(s: Session, id: string, txHash: string) {
  const { plan } = await loadPlanFor(id, s);
  if (plan.status !== "DRAFT") throw new PlanError("This plan is already confirmed", 409);
  const expected = txHashHex(parseTx(s.network, plan.setupXdr));
  if (txHash.toLowerCase() !== expected) throw new PlanError("That transaction is not this plan's setup", 400);

  const [account, reserve] = await Promise.all([loadAccountRaw(s.network, s.address), baseReserveStroops(s.network)]);
  if (!account) throw new PlanError("Account not found", 404);
  const st = derivePlanState(account, toRef(plan), Math.floor(Date.now() / 1000), reserve);
  if (st.state !== "ARMED" && st.state !== "ELIGIBLE") {
    // Horizon may lag a ledger behind the submit response.
    throw new PlanError(`The plan isn't visible on chain yet (state: ${st.state}). Try again in a few seconds.`, 409, st.diagnostics);
  }

  const supersedable = and(eq(plans.ownerAddress, s.address), eq(plans.network, s.network), ne(plans.id, plan.id), isNull(plans.supersededBy));
  const previous = await db().select({ id: plans.id }).from(plans).where(and(supersedable, ne(plans.status, "DRAFT")));
  await db().update(plans).set({ supersededBy: plan.id, updatedAt: new Date() }).where(supersedable);
  await db().update(plans).set({ status: st.state, setupTxHash: expected, lastSeqTime: st.seqTime, updatedAt: new Date() }).where(eq(plans.id, plan.id));
  await db().insert(planEvents).values({ planId: plan.id, type: previous.length ? "REARMED" : "ARMED", txHash: expected });
  return { state: st.state, eligibleAt: st.eligibleAt };
}

/** Plan + live state derived from the chain (the DB status is only a cache). */
export async function planWithState(plan: Plan, role: "owner" | "heir") {
  const [account, reserve] = await Promise.all([loadAccountRaw(plan.network as NetworkName, plan.ownerAddress), baseReserveStroops(plan.network as NetworkName)]);
  const derived = account ? derivePlanState(account, toRef(plan), Math.floor(Date.now() / 1000), reserve) : null;
  const state = plan.supersededBy ? "SUPERSEDED" : derived?.state ?? plan.status;
  return {
    id: plan.id, role, network: plan.network, owner: plan.ownerAddress, heir: plan.heirAddress,
    heirEmail: role === "owner" ? plan.heirEmail : undefined,
    variant: plan.variant, inactivitySeconds: plan.inactivitySecs, graceSeconds: plan.graceSecs,
    version: plan.version, createdAt: plan.createdAt, setupTxHash: plan.setupTxHash,
    phase1Seq: plan.phase1Seq, state,
    seqTime: derived?.seqTime, eligibleAt: derived?.eligibleAt, claimableAt: derived?.claimableAt,
    ownerCanPayFee: derived?.ownerCanPayFee, diagnostics: derived?.diagnostics ?? [],
    // Owner balances are shown to the heir only after handover (PRD H2).
    balances: role === "owner" || state === "INHERITED" ? account?.balances : undefined,
  };
}

export async function listPlans(s: Session, as: "owner" | "heir") {
  const col = as === "owner" ? plans.ownerAddress : plans.heirAddress;
  const where = as === "owner"
    ? and(eq(col, s.address), eq(plans.network, s.network), isNull(plans.supersededBy))
    : and(eq(col, s.address), eq(plans.network, s.network), isNull(plans.supersededBy), ne(plans.status, "DRAFT"));
  const rows = await db().select().from(plans).where(where).orderBy(desc(plans.createdAt)).limit(20);
  return Promise.all(rows.map((p) => planWithState(p, as)));
}

export function packetFor(plan: Plan) {
  if (plan.status === "DRAFT") throw new PlanError("The packet is available once the plan is armed", 409);
  return makePacket({
    network: plan.network as NetworkName, owner: plan.ownerAddress, heir: plan.heirAddress, variant: plan.variant as Variant,
    inactivitySeconds: plan.inactivitySecs, graceSeconds: plan.graceSecs, createdAt: plan.createdAt,
    plan: {
      baseSeq: BigInt(plan.baseSeq), phase1Seq: BigInt(plan.phase1Seq), phase2Seq: BigInt(plan.phase2Seq),
      phase1Hash: plan.phase1Hash, phase2Hash: plan.phase2Hash, phase1Xdr: plan.phase1Xdr, phase2Xdr: plan.phase2Xdr,
    },
  });
}


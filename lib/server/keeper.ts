import "server-only";
import { Keypair } from "@stellar/stellar-sdk";
import { and, asc, eq, isNull, notInArray } from "drizzle-orm";
import { parseTx, wrapFeeBump } from "@/lib/core/builders";
import type { NetworkName } from "@/lib/core/config";
import { dueNotifications, TRANSITION_EVENT } from "@/lib/core/notifications";
import { derivePlanState, type PlanState } from "@/lib/core/state";
import { baseReserveStroops, loadAccountRaw, submit } from "@/lib/stellar/horizon";
import { db, schema } from "./db";
import { dispatchAll } from "./notify";
import { toRef } from "./plans";

const { plans, planEvents } = schema;
const BATCH = 50;
const BUDGET_MS = 8_000;

export interface TickResult { processed: number; transitions: number; notified: number; submitted: number; errors: number }

function keeperKeypair(): Keypair | null {
  const s = process.env.KEEPER_SECRET;
  return s ? Keypair.fromSecret(s) : null;
}

/** A§9. Idempotent: notifications are deduplicated in the DB, Phase 1 can only succeed once. */
export async function tick(now = Math.floor(Date.now() / 1000)): Promise<TickResult> {
  const started = Date.now();
  const r: TickResult = { processed: 0, transitions: 0, notified: 0, submitted: 0, errors: 0 };
  const rows = await db().select().from(plans)
    .where(and(isNull(plans.supersededBy), notInArray(plans.status, ["DRAFT", "INHERITED", "REVOKED"])))
    .orderBy(asc(plans.updatedAt)).limit(BATCH);
  const reserves = new Map<NetworkName, bigint>();
  const keeper = keeperKeypair();

  for (const plan of rows) {
    if (Date.now() - started > BUDGET_MS) break; // the next tick continues with the oldest rows
    try {
      const network = plan.network as NetworkName;
      if (!reserves.has(network)) reserves.set(network, await baseReserveStroops(network));
      const account = await loadAccountRaw(network, plan.ownerAddress);
      if (!account) continue;
      const st = derivePlanState(account, toRef(plan), now, reserves.get(network)!);

      if (st.state !== plan.status) {
        const event = TRANSITION_EVENT[st.state as PlanState];
        if (event) {
          const txHash = event === "PHASE1" ? plan.phase1Hash : event === "PHASE2" ? plan.phase2Hash : null;
          await db().insert(planEvents).values({ planId: plan.id, type: event, txHash });
        }
        r.transitions++;
      }
      r.notified += await dispatchAll(plan, dueNotifications(plan.status, st, toRef(plan), now), { eligibleAt: st.eligibleAt, claimableAt: st.claimableAt });
      await db().update(plans).set({ status: st.state, lastSeqTime: st.seqTime, updatedAt: new Date() }).where(eq(plans.id, plan.id));

      if (st.state === "ELIGIBLE" && plan.autoStartClaim && keeper) {
        const fb = wrapFeeBump(network, keeper.publicKey(), parseTx(network, plan.phase1Xdr));
        fb.sign(keeper);
        const res = await submit(network, fb);
        // NOT_YET is a harmless race with the owner; anything else is logged and retried next tick.
        if (res.ok) r.submitted++;
        else if (res.error.kind !== "NOT_YET") console.error("phase1 submit failed", plan.id, res.error.codes);
      }
      r.processed++;
    } catch (e) {
      r.errors++;
      console.error("keeper error", plan.id, (e as Error).message);
    }
  }
  return r;
}

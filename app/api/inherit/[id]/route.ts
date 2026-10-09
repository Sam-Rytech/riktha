import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { packetFromRow } from "@/lib/server/packet";
import { PlanError } from "@/lib/server/plans";

/**
 * Public, for claim-kit heirs who have no account to sign in with (A§15). Returns the latest version's
 * packet, which holds only public transactions and the encrypted kit. Useless without the claim code.
 */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/inherit/[id]">) => {
  let id = (await ctx.params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PlanError("Plan not found", 404);
  for (let hops = 0; hops < 25; hops++) {
    const [plan] = await db().select().from(schema.plans).where(eq(schema.plans.id, id)).limit(1);
    if (!plan || plan.heirKind !== "kit" || plan.status === "DRAFT") throw new PlanError("Plan not found", 404);
    if (!plan.supersededBy) {
      return Response.json({ planId: plan.id, packet: packetFromRow(plan) }, { headers: { "Cache-Control": "no-store" } });
    }
    id = plan.supersededBy;
  }
  throw new PlanError("Plan not found", 404);
});

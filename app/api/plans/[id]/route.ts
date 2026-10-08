import { requireSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { loadPlanFor, planWithState } from "@/lib/server/plans";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/plans/[id]">) => {
  const s = await requireSession();
  const { plan, role } = await loadPlanFor((await ctx.params).id, s, ["owner", "heir"]);
  return Response.json(await planWithState(plan, role), { headers: { "Cache-Control": "no-store" } });
});

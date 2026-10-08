import { requireSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { loadPlanFor, packetFor } from "@/lib/server/plans";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/plans/[id]/packet">) => {
  const s = await requireSession();
  const { plan } = await loadPlanFor((await ctx.params).id, s, ["owner", "heir"]);
  return new Response(JSON.stringify(packetFor(plan), null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="riktha-packet-${plan.ownerAddress.slice(0, 6)}-v${plan.version}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

import { z } from "zod";
import { requireSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { confirmRevoke, revokeTx } from "@/lib/server/plans";

/** GET: unsigned revoke transaction. POST { txHash }: confirm it on chain. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/plans/[id]/revoke">) => {
  const s = await requireSession();
  return Response.json(await revokeTx(s, (await ctx.params).id), { headers: { "Cache-Control": "no-store" } });
});

const body = z.object({ txHash: z.string().regex(/^[0-9a-fA-F]{64}$/) });

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/plans/[id]/revoke">) => {
  const s = await requireSession();
  return Response.json(await confirmRevoke(s, (await ctx.params).id, body.parse(await req.json()).txHash));
});

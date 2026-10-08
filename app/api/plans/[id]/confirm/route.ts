import { z } from "zod";
import { requireSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { confirmSetup } from "@/lib/server/plans";

const body = z.object({ txHash: z.string().regex(/^[0-9a-fA-F]{64}$/) });

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/plans/[id]/confirm">) => {
  const s = await requireSession();
  const { txHash } = body.parse(await req.json());
  return Response.json(await confirmSetup(s, (await ctx.params).id, txHash));
});

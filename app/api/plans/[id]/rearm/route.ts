import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { rearm } from "@/lib/server/plans";

const body = z.object({
  heir: z.string().trim().refine((s) => StrKey.isValidEd25519PublicKey(s), "Invalid heir address").optional(),
  inactivitySeconds: z.number().int().positive().optional(),
  graceSeconds: z.number().int().positive().optional(),
  heirEmail: z.email().max(254).nullable().optional(),
});

/** New draft (same shape as POST /api/plans); confirm it with /api/plans/{newId}/confirm. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/plans/[id]/rearm">) => {
  const s = await requireSession();
  const input = body.parse(await req.json().catch(() => ({})));
  return Response.json(await rearm(s, (await ctx.params).id, input));
});

import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import { claimKitSchema } from "@/lib/core/claimkit";
import { requireSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { createDraft, listPlans } from "@/lib/server/plans";

const body = z.object({
  heir: z.string().trim().refine((s) => StrKey.isValidEd25519PublicKey(s), "That isn't a valid Stellar address (it should start with G)."),
  inactivitySeconds: z.number().int().positive(),
  graceSeconds: z.number().int().positive(),
  heirEmail: z.email().max(254).optional().or(z.literal("")),
  heirKit: claimKitSchema.optional(),
});

export const POST = handle(async (req: Request) => {
  const s = await requireSession();
  return Response.json(await createDraft(s, body.parse(await req.json())));
});

export const GET = handle(async () => {
  const s = await requireSession();
  return Response.json({ plans: await listPlans(s, "owner") }, { headers: { "Cache-Control": "no-store" } });
});

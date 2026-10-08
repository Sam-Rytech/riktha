import { requireSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { listPlans } from "@/lib/server/plans";

export const GET = handle(async () => {
  const s = await requireSession();
  return Response.json({ plans: await listPlans(s, "heir") }, { headers: { "Cache-Control": "no-store" } });
});

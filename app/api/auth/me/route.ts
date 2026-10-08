import { getSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const GET = handle(async () => {
  const session = await getSession();
  return Response.json(session ?? { address: null }, { headers: { "Cache-Control": "no-store" } });
});

import { clearSessionCookie } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const POST = handle(async () => {
  await clearSessionCookie();
  return Response.json({ ok: true });
});

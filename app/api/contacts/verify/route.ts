import type { NextRequest } from "next/server";
import { verifyEmailToken } from "@/lib/server/contacts";
import { handle } from "@/lib/server/http";

export const GET = handle(async (req: NextRequest) => {
  const ok = await verifyEmailToken(req.nextUrl.searchParams.get("token") ?? "");
  return Response.redirect(new URL(`/settings?verified=${ok ? 1 : 0}`, req.nextUrl.origin), 303);
});

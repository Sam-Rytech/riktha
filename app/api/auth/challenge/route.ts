import type { NextRequest } from "next/server";
import { createChallenge, requestHost } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const GET = handle(async (req: NextRequest) => {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  return Response.json(createChallenge(address, requestHost(req)));
});

import { z } from "zod";
import { requestHost, setSessionCookie, verifyChallenge } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

const body = z.object({ signedXdr: z.string().min(1).max(10_000) });

export const POST = handle(async (req: Request) => {
  const { signedXdr } = body.parse(await req.json());
  const address = verifyChallenge(signedXdr, requestHost(req));
  await setSessionCookie(address);
  return Response.json({ address });
});

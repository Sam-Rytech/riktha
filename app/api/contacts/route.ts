import { z } from "zod";
import { requireSession } from "@/lib/server/auth";
import { getContact, setEmail } from "@/lib/server/contacts";
import { handle } from "@/lib/server/http";

export const GET = handle(async () => {
  const s = await requireSession();
  return Response.json(await getContact(s.address), { headers: { "Cache-Control": "no-store" } });
});

const body = z.object({ email: z.email().max(254).nullable() });

/** PUT { email } sends a verification link; { email: null } removes it. */
export const PUT = handle(async (req: Request) => {
  const s = await requireSession();
  return Response.json(await setEmail(s.address, body.parse(await req.json()).email));
});

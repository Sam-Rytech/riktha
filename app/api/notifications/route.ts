import { and, eq, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { inbox } from "@/lib/server/notify";

export const GET = handle(async () => {
  const s = await requireSession();
  return Response.json({ notifications: await inbox(s.address) }, { headers: { "Cache-Control": "no-store" } });
});

/** Mark all my dashboard notifications read. */
export const POST = handle(async () => {
  const s = await requireSession();
  const n = schema.notifications;
  await db().update(n).set({ readAt: new Date() })
    .where(and(eq(n.recipient, s.address), eq(n.channel, "dashboard"), isNull(n.readAt)));
  return Response.json({ ok: true });
});

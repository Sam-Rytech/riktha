import { requireSession } from "@/lib/server/auth";
import { createTelegramLink, unlinkTelegram } from "@/lib/server/contacts";
import { handle } from "@/lib/server/http";

/** POST: one-time deep link (valid 15 min). DELETE: unlink. */
export const POST = handle(async () => Response.json(await createTelegramLink((await requireSession()).address)));
export const DELETE = handle(async () => Response.json(await unlinkTelegram((await requireSession()).address)));

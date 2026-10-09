import { handle } from "@/lib/server/http";
import { tick } from "@/lib/server/keeper";
import { safeEqual } from "@/lib/server/secrets";

export const maxDuration = 30;

// cron-job.org calls POST every minute; Vercel's daily backup cron calls GET. Both send the bearer secret.
const run = handle(async (req: Request) => {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!safeEqual(auth, process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await tick());
});

export const POST = run;
export const GET = run;

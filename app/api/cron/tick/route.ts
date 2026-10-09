import { handle } from "@/lib/server/http";
import { tick } from "@/lib/server/keeper";
import { safeEqual } from "@/lib/server/secrets";

export const maxDuration = 30;

// cron-job.org calls POST every minute; Vercel's daily backup cron calls GET. Both send the bearer secret.
const run = handle(async (req: Request) => {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!safeEqual(auth, process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // `?only=<planId>,…` limits a run to specific plans (used by scripted scenario runs).
  const only = new URL(req.url).searchParams.get("only")?.split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  return Response.json(await tick({ only }));
});

export const POST = run;
export const GET = run;

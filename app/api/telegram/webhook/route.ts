import { and, eq, isNull, ne, or } from "drizzle-orm";
import { addressForChat, redeemTelegramToken } from "@/lib/server/contacts";
import { db, schema } from "@/lib/server/db";
import { appUrl } from "@/lib/server/notify";
import { sendTelegram } from "@/lib/server/notify/telegram";
import { safeEqual } from "@/lib/server/secrets";

interface Update { message?: { chat: { id: number }; text?: string } }

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const STATE_TEXT: Record<string, string> = {
  ARMED: "armed (clock running)", ELIGIBLE: "inactivity window passed", NOTICE: "claim started (grace period)",
  CLAIMABLE: "handover possible", INHERITED: "handed over", CANCELLED: "cancelled, re-arm needed", REVOKED: "revoked", BROKEN: "needs attention",
};

async function status(chatId: string): Promise<string> {
  const address = await addressForChat(chatId);
  if (!address) return "This chat isn't linked yet. Open Settings in Riktha and press \"Link Telegram\".";
  const p = schema.plans;
  const rows = await db().select().from(p)
    .where(and(isNull(p.supersededBy), ne(p.status, "DRAFT"), or(eq(p.ownerAddress, address), eq(p.heirAddress, address))));
  if (!rows.length) return `Linked to ${short(address)}. No active plans.`;
  const lines = rows.map((r) => `• ${r.ownerAddress === address ? "Your plan" : `Plan of ${short(r.ownerAddress)} (you are heir)`}: ${STATE_TEXT[r.status] ?? r.status}`);
  return `Linked to ${short(address)}.\n${lines.join("\n")}\n\n${appUrl()}/dashboard`;
}

/** Always 200 so Telegram doesn't retry; the secret header proves the call came from Telegram. */
export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const update = (await req.json()) as Update;
    const msg = update.message;
    if (!msg?.text) return Response.json({ ok: true });
    const chatId = String(msg.chat.id);
    const [cmd, arg] = msg.text.trim().split(/\s+/, 2);

    if (cmd === "/start" && arg) {
      const address = await redeemTelegramToken(arg, chatId);
      await sendTelegram(chatId, address
        ? `Linked to ${short(address)}. You'll get Riktha reminders and urgent alerts here. Send /status any time.`
        : "That link expired or was already used. Create a new one in Riktha → Settings.");
    } else if (cmd === "/status") {
      await sendTelegram(chatId, await status(chatId));
    } else {
      await sendTelegram(chatId, `Riktha sends inheritance-plan alerts. To link this chat, open ${appUrl()}/settings and press "Link Telegram". Commands: /status`);
    }
  } catch (e) {
    console.error("telegram webhook", (e as Error).message);
  }
  return Response.json({ ok: true });
}

import "server-only";

const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export const telegramEnabled = () => !!process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!telegramEnabled()) return false;
  try {
    const r = await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
    });
    if (!r.ok) console.error("telegram failed", r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error("telegram failed", (e as Error).message);
    return false;
  }
}

export function botUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME ?? "RikthaBot";
}

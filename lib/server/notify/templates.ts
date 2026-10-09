import type { NotificationKind } from "@/lib/core/notifications";
import { formatDuration } from "@/lib/core/eligibility";

export interface TemplateCtx {
  appUrl: string;
  owner: string;
  heir: string;
  inactivitySeconds: number;
  graceSeconds: number;
  /** unix seconds */
  eligibleAt?: number;
  claimableAt?: number;
}
export interface Message { title: string; body: string; cta?: { label: string; url: string } }

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const fmtDate = (unix?: number) =>
  unix ? new Date(unix * 1000).toUTCString().replace(/:\d\d GMT$/, " UTC") : "soon";

export function render(kind: NotificationKind, c: TemplateCtx): Message {
  const dash = { label: "Open your dashboard", url: `${c.appUrl}/dashboard` };
  const heirPage = { label: "Open your heir page", url: `${c.appUrl}/heir` };
  const I = formatDuration(c.inactivitySeconds), G = formatDuration(c.graceSeconds);
  switch (kind) {
    case "ARMED_OWNER":
      return { title: "Your Riktha plan is armed", body: `If your account ${short(c.owner)} sends nothing for ${I}, a claim can start. Using your account normally resets the clock. Your heir is ${short(c.heir)}.`, cta: dash };
    case "ARMED_HEIR":
      return { title: "You've been named as an heir on Riktha", body: `The owner of Stellar account ${short(c.owner)} named your account ${short(c.heir)} as their heir. You can do nothing yet. If the owner stops using their account for ${I}, we'll tell you when you can act. Keep the attached inheritance packet somewhere safe: it lets you claim even without Riktha.`, cta: heirPage };
    case "REMIND_50":
    case "REMIND_80":
    case "REMIND_95": {
      const pct = kind.slice(-2);
      return { title: `Check in: ${pct}% of your inactivity window has passed`, body: `Your account ${short(c.owner)} hasn't sent anything for a while. If nothing is sent by ${fmtDate(c.eligibleAt)}, a claim can start. Send any transaction, or press "I'm alive" on your dashboard.`, cta: dash };
    }
    case "NOTICE_OWNER":
      return { title: "URGENT: a claim on your account has started", body: `Your account ${short(c.owner)} was inactive for ${I}, so a claim started. If you're reading this, send any transaction before ${fmtDate(c.claimableAt)} to cancel it, or press "Cancel the claim" on your dashboard.`, cta: dash };
    case "NOTICE_HEIR":
      return { title: "The owner's inactivity window has passed", body: `Account ${short(c.owner)} has been inactive for ${I}. The owner now has ${G} to respond. Unless they do, you can complete the handover from ${fmtDate(c.claimableAt)}.`, cta: heirPage };
    case "GRACE_50":
    case "GRACE_90":
      return { title: "URGENT: your heir can take over soon", body: `A claim on your account ${short(c.owner)} is in progress. Unless you send any transaction before ${fmtDate(c.claimableAt)}, your heir ${short(c.heir)} will be able to control your account.`, cta: dash };
    case "CLAIMABLE_HEIR":
      return { title: "You can complete the handover now", body: `The owner of ${short(c.owner)} didn't respond during the ${G} grace period. You can now add your key to their account and move the assets.`, cta: heirPage };
    case "INHERITED_OWNER":
      return { title: "Your account was handed over", body: `Your heir ${short(c.heir)} is now a signer on ${short(c.owner)}. Your own key still works.`, cta: dash };
    case "INHERITED_HEIR":
      return { title: "Handover complete: move the assets", body: `Your key can now sign for ${short(c.owner)}. Open your heir page to move each asset to your own account.`, cta: heirPage };
    case "CANCELLED_OWNER":
      return { title: "Claim cancelled. Re-arm your plan.", body: `You used your account ${short(c.owner)}, so the claim was cancelled for good. Your plan needs to be re-armed to protect you again.`, cta: dash };
    case "CANCELLED_HEIR":
      return { title: "The owner responded: claim cancelled", body: `The owner of ${short(c.owner)} used their account, so this claim was cancelled. If they re-arm their plan, you'll hear from us again.`, cta: heirPage };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

export function toEmail(m: Message, urgent: boolean): { subject: string; text: string; html: string } {
  const text = `${m.body}${m.cta ? `\n\n${m.cta.label}: ${m.cta.url}` : ""}\n\n— Riktha · inheritance for Stellar accounts (testnet)`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f3ea;font-family:Georgia,serif;color:#1d1b16">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:${urgent ? "#8a1c1c" : "#1f4d3a"};margin:0 0 8px">${urgent ? "Urgent" : "Riktha"}</p>
<h1 style="font-size:22px;font-weight:normal;margin:0 0 16px">${esc(m.title)}</h1>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#3b382f">${esc(m.body)}</p>
${m.cta ? `<p style="margin:24px 0"><a href="${esc(m.cta.url)}" style="background:#1f4d3a;color:#fffdf8;padding:10px 18px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px">${esc(m.cta.label)}</a></p>` : ""}
<p style="font-family:Arial,sans-serif;font-size:12px;color:#5f5a4e;margin-top:32px">Riktha · inheritance for Stellar accounts (testnet). Riktha never holds your keys.</p>
</div></body></html>`;
  return { subject: urgent ? `URGENT: ${m.title.replace(/^URGENT: /, "")}` : m.title, text, html };
}

export function toTelegram(m: Message, urgent: boolean): string {
  return `${urgent ? "🔴 " : ""}*${m.title.replace(/[*_`[]/g, "")}*\n\n${m.body.replace(/[*_`[]/g, "")}${m.cta ? `\n\n${m.cta.label}: ${m.cta.url}` : ""}`;
}

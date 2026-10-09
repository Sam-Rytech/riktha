import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return (transport = null);
  const port = Number(SMTP_PORT ?? 465);
  return (transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, "") } })); // Google shows app passwords with spaces
}

export const emailEnabled = () => getTransport() !== null;

export interface Attachment { filename: string; content: string; contentType: string }

/** Returns false (and logs) instead of throwing, so one bad address never stops the keeper. */
export async function sendEmail(to: string, mail: { subject: string; text: string; html: string }, attachments: Attachment[] = []): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to, ...mail, attachments });
    return true;
  } catch (e) {
    console.error("email failed", to.replace(/(.).+@/, "$1…@"), (e as Error).message);
    return false;
  }
}

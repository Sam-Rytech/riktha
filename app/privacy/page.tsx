import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Riktha",
  description: "What Riktha stores, why, and who handles it.",
};

const SECTIONS: [string, React.ReactNode][] = [
  ["What we store", (
    <ul key="s" className="list-disc space-y-2 pl-5">
      <li>Your Stellar address, and your heir&apos;s address if you named one.</li>
      <li>The two pre-signed transactions for your plan, and its status and history.</li>
      <li>Email addresses you give us: yours for reminders, and your heir&apos;s if you named them by email.</li>
      <li>Your Telegram chat ID, if you link Telegram.</li>
      <li>If you use a claim kit: your heir&apos;s key, encrypted in your browser with the six-word code. We never see the code, so we can&apos;t unlock it.</li>
    </ul>
  )],
  ["Why", "Only to run your plan: to watch your account's activity on the public Stellar network, send you reminders and alerts, and tell your heir when they can claim. We don't sell or share your data, and we don't use it for ads."],
  ["Cookies", "One cookie keeps you signed in after you prove you own your Stellar address. There are no tracking or analytics cookies, so there's nothing to consent to."],
  ["Who handles it", "Vercel hosts the site, Neon hosts the database, Gmail delivers email and Telegram delivers Telegram messages. Your plan's transactions are on the public Stellar ledger, like every Stellar transaction."],
  ["Your choices", "You can remove your email or unlink Telegram in Settings, or revoke your plan from the dashboard. To have everything deleted, contact us via the project's GitHub page."],
  ["Status", "Riktha is a testnet preview made for a hackathon. It's unaudited, and it isn't a legal will."],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-[var(--inset)] pb-6 pt-8 sm:pt-12">
      <div className="rounded-[var(--radius-slab)] bg-surface px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="headline text-[32px] sm:text-[44px]">Privacy</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">The short version: we keep only what&apos;s needed to run your plan, and we never hold a key that can move your funds.</p>
        <dl className="mt-10 divide-y divide-line border-y border-line">
          {SECTIONS.map(([t, body]) => (
            <div key={t} className="grid gap-2 py-6 sm:grid-cols-[180px_1fr] sm:gap-8">
              <dt className="text-[16px] font-semibold">{t}</dt>
              <dd className="text-[15px] leading-relaxed text-muted">{body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-[13px] text-muted">Last updated 10 October 2026.</p>
      </div>
    </main>
  );
}

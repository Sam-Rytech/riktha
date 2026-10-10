import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import AccountMismatch from "@/components/AccountMismatch";
import SiteHeader, { Wordmark } from "@/components/SiteHeader";
import "./globals.css";

const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const accent = Instrument_Serif({ variable: "--font-accent", subsets: ["latin"], weight: "400", style: ["italic", "normal"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });

const SOCIAL = [
  { label: "Riktha on Telegram", href: "https://t.me/RikthaBot", icon: "M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.3 13 1.5 11.5c-1-.3-1.1-1 .2-1.5L20.6 2.7c.9-.3 1.6.2 1.3 1.6z" },
  { label: "Source on GitHub", href: "https://github.com/Sam-Rytech/riktha", icon: "M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" },
];

export const metadata: Metadata = {
  title: "Riktha · Inheritance for Stellar accounts",
  description: "Pass on your Stellar account to someone you trust, enforced by the Stellar protocol itself. No custodian, no shared seed phrase.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${accent.variable} ${code.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
        {/* SiteHeader reads the pathname (runtime data), so it streams in behind a Suspense boundary. */}
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        {/* The header is out of flow; reserve its height except on pages whose hero hosts it. */}
        <div aria-hidden className="h-[calc(var(--inset)+56px)] shrink-0 [body:has(#hero)_&]:hidden" />
        <AccountMismatch />
        <div id="main" className="flex flex-1 flex-col">{children}</div>
        <footer className="slab mb-[var(--inset)] mt-16 bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-8 pt-12 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Wordmark />
              <p className="mt-3 text-[14px] text-muted">Inheritance for Stellar accounts.</p>
              <ul className="mt-6 flex gap-2">
                {SOCIAL.map((x) => (
                  <li key={x.label}>
                    <a href={x.href} target="_blank" rel="noreferrer" aria-label={x.label} title={x.label}
                      className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden><path d={x.icon} /></svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <nav aria-label="Product" className="flex flex-col gap-2.5 text-[14px]">
              <p className="mb-1 text-[13px] text-muted">Product</p>
              <Link href="/plan/new" className="hover:text-green">Create a plan</Link>
              <Link href="/claim" className="hover:text-green">Claim with a packet</Link>
              <Link href="/evidence" className="hover:text-green">Evidence on testnet</Link>
            </nav>
            <nav aria-label="Project" className="flex flex-col gap-2.5 text-[14px]">
              <p className="mb-1 text-[13px] text-muted">Project</p>
              <a href="https://github.com/Sam-Rytech/riktha" className="hover:text-green">Source code</a>
              <a href="https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md" className="hover:text-green">CAP-21 specification</a>
              <Link href="/privacy" className="hover:text-green">Privacy</Link>
            </nav>
          </div>
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-line px-6 py-5 text-[13px] text-muted sm:px-10">
            <p>© 2026 Riktha</p>
            <p>Testnet preview · not a legal will</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

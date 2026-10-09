import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import AccountMismatch from "@/components/AccountMismatch";
import SiteHeader, { Wordmark } from "@/components/SiteHeader";
import "./globals.css";

const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const accent = Instrument_Serif({ variable: "--font-accent", subsets: ["latin"], weight: "400", style: ["italic", "normal"] });
const code = Geist_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Riktha · Inheritance for Stellar accounts",
  description: "Pass on your Stellar account to someone you trust, enforced by the Stellar protocol itself. No custodian, no shared seed phrase.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${accent.variable} ${code.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
        <SiteHeader />
        <AccountMismatch />
        <div id="main" className="flex flex-1 flex-col">{children}</div>
        <footer className="slab mb-[var(--inset)] mt-16 bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-10">
            <div>
              <Wordmark />
              <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-muted">Inheritance for Stellar accounts, enforced by the protocol. Testnet preview, unaudited, and not a legal will.</p>
            </div>
            <nav aria-label="Product" className="flex flex-col gap-2 text-[14px]">
              <Link href="/plan/new" className="hover:text-green">Create a plan</Link>
              <Link href="/claim" className="hover:text-green">Claim with a packet</Link>
              <Link href="/evidence" className="hover:text-green">Evidence on testnet</Link>
            </nav>
            <nav aria-label="Project" className="flex flex-col gap-2 text-[14px]">
              <a href="https://github.com/Sam-Rytech/riktha" className="hover:text-green">Source code</a>
              <a href="https://github.com/stellar/stellar-protocol/blob/master/core/cap-0021.md" className="hover:text-green">CAP-21 specification</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}

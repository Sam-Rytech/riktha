import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import Link from "next/link";
import ConnectButton from "@/components/ConnectButton";
import "./globals.css";

const heading = Fraunces({ variable: "--font-heading", subsets: ["latin"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const code = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Riktha · Inheritance for Stellar accounts",
  description: "Pass on your Stellar account to someone you trust, enforced by the Stellar protocol itself. No custodian, no shared seed phrase.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} ${code.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight">Riktha</Link>
            <div className="order-last flex w-full items-center gap-5 overflow-x-auto text-sm sm:order-none sm:w-auto">
              <nav aria-label="Main" className="flex items-center gap-5 whitespace-nowrap">
                <Link href="/dashboard" className="underline-offset-4 hover:underline">Dashboard</Link>
                <Link href="/heir" className="underline-offset-4 hover:underline">I&apos;m an heir</Link>
                <Link href="/claim" className="underline-offset-4 hover:underline">Claim with packet</Link>
                <Link href="/settings" className="underline-offset-4 hover:underline">Settings</Link>
              </nav>
            </div>
            <ConnectButton />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
            <p>Riktha · Stellar testnet · unaudited · not a legal will</p>
            <nav aria-label="Footer" className="flex gap-4">
              <Link href="/evidence" className="underline-offset-4 hover:underline">Evidence</Link>
              <a href="https://github.com/Sam-Rytech/riktha" className="underline-offset-4 hover:underline">Source</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}

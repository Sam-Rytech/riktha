"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ConnectButton from "./ConnectButton";
import { containerCls } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/heir", label: "I'm an heir" },
  { href: "/claim", label: "Claim with packet" },
  { href: "/settings", label: "Settings" },
];

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <rect width="24" height="24" rx="7" fill="currentColor" />
        <path d="M8 18V6h4.6c2.5 0 4 1.4 4 3.5 0 1.6-.9 2.8-2.4 3.2L17 18h-2.8l-2.5-5H10.5v5zm2.5-7.1h2c1.1 0 1.7-.5 1.7-1.4s-.6-1.4-1.7-1.4h-2z" fill="var(--stone)" />
      </svg>
      <span className="text-[19px] font-semibold tracking-[-0.03em]">Riktha</span>
    </span>
  );
}

/** Floating frosted pill nav; becomes a round menu button + sheet on small screens. */
export default function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <header className={`sticky top-0 z-40 border-b transition-[background,border-color] duration-300 ${scrolled || open ? "border-line bg-stone/90 backdrop-blur-xl" : "border-transparent bg-stone"}`}>
      <div className={`${containerCls} flex h-16 items-center justify-between gap-3`}>
        <Link href="/" className="text-ink" aria-label="Riktha home"><Wordmark /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-[14px] transition-colors ${path === n.href ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-ink/70 hover:text-ink"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><ConnectButton /></div>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface lg:hidden">
            <span aria-hidden className="relative block h-3 w-4">
              <span className={`absolute left-0 h-[1.5px] w-4 bg-ink transition-transform duration-300 ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 h-[1.5px] w-4 bg-ink transition-transform duration-300 ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-menu" className={`${containerCls} pb-4 lg:hidden`}>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-2">
          <nav aria-label="Mobile" className="flex flex-col">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-xl px-4 py-3.5 text-[17px] hover:bg-stone">{n.label}</Link>
            ))}
          </nav>
          <div className="border-t border-line p-3 sm:hidden"><ConnectButton /></div>
          </div>
        </div>
      )}
    </header>
  );
}

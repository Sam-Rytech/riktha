"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import ConnectButton from "./ConnectButton";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/heir", label: "I'm an heir" },
  { href: "/claim", label: "Claim with packet" },
  { href: "/settings", label: "Settings" },
];

/**
 * The Handover mark: a solid dot (the owner) overlapped by a ring (the heir) of the same outer size. A thin gap is
 * cut from the dot where the ring crosses it, so the two shapes stay distinct at any size and in any colour.
 */
export function Mark({ size = 22, ring = "var(--green)", className = "" }: { size?: number; ring?: string; className?: string }) {
  const gap = useId();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={className}>
      <mask id={gap}>
        <rect width="24" height="24" fill="white" />
        <circle cx="15.25" cy="12" r="5.4" fill="none" stroke="black" strokeWidth="5" />
      </mask>
      <circle cx="8.75" cy="12" r="6.75" fill="currentColor" mask={`url(#${gap})`} />
      <circle cx="15.25" cy="12" r="5.4" fill="none" stroke={ring} strokeWidth="2.7" />
    </svg>
  );
}

export function Wordmark({ className = "", ring }: { className?: string; ring?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark ring={ring} />
      <span className="text-[19px] font-semibold tracking-[-0.03em]">Riktha</span>
    </span>
  );
}

/**
 * Always fixed. On a page with a `#hero` slab it keeps its transparent in-hero look while over the hero; once the
 * hero is gone the light pill slides in. Elsewhere the light pill is always shown.
 * The header is always out of flow; the layout's spacer reserves its height on pages without a hero.
 */
export default function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [hasHero, setHasHero] = useState(path === "/");

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const hero = document.getElementById("hero");
    setHasHero(!!hero);
    if (!hero) return;
    const on = () => setPastHero(hero.getBoundingClientRect().bottom < 80);
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const inHero = hasHero && !pastHero;
  const reduce = useReducedMotion();
  // The sheet grows out of the menu button and shrinks back into it: the transform origin is the button's centre,
  // 36px above the sheet and --mx in from its right edge (pill: 12px padding + 20px; in-hero: 24/40px + 20px).
  const closed = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.15, filter: "blur(6px)", transition: { duration: 0.28, ease: [0.4, 0, 1, 1] as const } };

  return (
    <header
      className={inHero
        ? "fixed inset-x-0 top-0 z-40 px-[var(--inset)] pt-[calc(var(--inset)+12px)]"
        : `fixed inset-x-0 top-0 z-40 px-[var(--inset)] pt-[var(--inset)] ${hasHero ? "animate-nav-in" : ""}`}>
      <div className={inHero
        ? "mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-2 text-white sm:px-10"
        : "mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-line bg-surface/85 px-3 py-2 pl-4 shadow-[0_8px_30px_-12px_rgba(13,20,17,0.18)] backdrop-blur-xl"}>
        <Link href="/" className={inHero ? "text-white" : "text-ink"} aria-label="Riktha home">
          <Wordmark ring={inHero ? "var(--glow)" : "var(--green)"} />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-[14px] transition-colors ${
                inHero ? "text-white/75 hover:bg-white/10 hover:text-white"
                  : path === n.href ? "bg-ink text-white" : "text-ink/75 hover:bg-ink/5 hover:text-ink"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><ConnectButton tone={inHero ? "night" : "light"} /></div>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}
            className={`grid h-10 w-10 place-items-center rounded-full border lg:hidden ${inHero ? "border-white/25" : "border-line bg-surface"}`}>
            <span aria-hidden className="relative block h-3 w-4">
              <span className={`absolute left-0 h-[1.5px] w-4 transition-transform duration-300 ${inHero ? "bg-white" : "bg-ink"} ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 h-[1.5px] w-4 transition-transform duration-300 ${inHero ? "bg-white" : "bg-ink"} ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div key="menu" id="mobile-menu" initial={closed} animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }} exit={closed} style={{ transformOrigin: "calc(100% - var(--mx)) -36px" }}
            className={`mx-auto mt-2 max-w-6xl rounded-[var(--radius-slab)] border border-line bg-surface p-3 text-ink shadow-[0_20px_50px_-20px_rgba(13,20,17,0.3)] lg:hidden ${inHero ? "[--mx:44px] sm:[--mx:60px]" : "[--mx:32px]"}`}>
            <motion.nav aria-label="Mobile" className="flex flex-col" initial="hide" animate="show" exit="hide"
              variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } }, hide: { transition: { staggerChildren: 0.02, staggerDirection: -1 } } }}>
              {NAV.map((n) => (
                <motion.div key={n.href} variants={{ hide: { opacity: 0, y: reduce ? 0 : -6 }, show: { opacity: 1, y: 0 } }}>
                  <Link href={n.href} className="block rounded-2xl px-4 py-3.5 text-[17px] hover:bg-stone">{n.label}</Link>
                </motion.div>
              ))}
            </motion.nav>
            <div className="border-t border-line p-3 sm:hidden"><ConnectButton /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { currentAddress } from "@/lib/wallet/freighter";
import { signIn, whoAmI } from "@/lib/wallet/session";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/**
 * The session cookie outlives a Freighter account switch. Warn when the account Freighter
 * would sign with differs from the one this site is signed in as (found in manual testing).
 */
export default function AccountMismatch() {
  const [pair, setPair] = useState<{ session: string; wallet: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const [session, wallet] = await Promise.all([whoAmI(), currentAddress()]);
        if (alive) setPair(session && wallet && session !== wallet ? { session, wallet } : null);
      } catch { /* Freighter missing or locked: nothing to compare */ }
    };
    check();
    const t = setInterval(check, 5000);
    window.addEventListener("focus", check);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", check); };
  }, []);

  if (!pair) return null;
  return (
    <div role="alert" className="border-b border-danger/40 bg-danger/5">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
        <p>
          Freighter is set to <b className="font-mono">{short(pair.wallet)}</b>, but you&apos;re signed in here as{" "}
          <b className="font-mono">{short(pair.session)}</b>. Actions on this site use the signed-in account.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true); setError(undefined);
            try { await signIn(); window.location.reload(); } catch (e) { setError((e as Error).message); setBusy(false); }
          }}
          className="rounded-full bg-danger px-4 py-1.5 font-medium text-paper hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Check Freighter…" : `Switch to ${short(pair.wallet)}`}
        </button>
        {error && <p className="w-full text-danger">{error}</p>}
      </div>
    </div>
  );
}

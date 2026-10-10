"use client";

import { useEffect, useState } from "react";
import { currentAddress } from "@/lib/wallet/freighter";
import { signIn, useSession } from "@/lib/wallet/session";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/**
 * The session cookie outlives a Freighter account switch. Warn when the account Freighter
 * would sign with differs from the one this site is signed in as (found in manual testing).
 */
export default function AccountMismatch() {
  const { address: session } = useSession();
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const w = await currentAddress();
        if (alive) setWallet(w ?? null);
      } catch { /* Freighter missing or locked: nothing to compare */ }
    };
    check();
    const t = setInterval(check, 5000);
    window.addEventListener("focus", check);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", check); };
  }, []);

  const pair = session && wallet && session !== wallet ? { session, wallet } : null;
  if (!pair) return null;
  return (
    <div role="alert" className="mx-[var(--inset)] mt-2">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-oxblood/30 bg-oxblood-tint px-5 py-3 text-[14px] text-oxblood">
        <p>
          Freighter is set to <b className="font-mono">{short(pair.wallet)}</b>, but you&apos;re signed in here as{" "}
          <b className="font-mono">{short(pair.session)}</b>. Actions on this site use the signed-in account.
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true); setError(undefined);
            try { await signIn(); setBusy(false); } catch (e) { setError((e as Error).message); setBusy(false); }
          }}
          className="rounded-full bg-oxblood px-4 py-2 font-medium text-white hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Check Freighter…" : `Switch to ${short(pair.wallet)}`}
        </button>
        {error && <p className="w-full text-danger">{error}</p>}
      </div>
    </div>
  );
}

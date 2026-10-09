"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, whoAmI } from "@/lib/wallet/session";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function ConnectButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    whoAmI().then(setAddress).catch(() => setAddress(null));
  }, []);

  const onSignIn = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setAddress(await signIn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (address) {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-2 rounded-full bg-stone px-3 py-2 font-mono text-[13px]" title={address}>
          <span aria-hidden className="h-2 w-2 rounded-full bg-green" />{short(address)}
        </span>
        <button onClick={async () => { await signOut(); setAddress(null); }} className="rounded-full px-3 py-2 text-[13px] text-muted hover:bg-ink/5 hover:text-ink">Sign out</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <button onClick={onSignIn} disabled={busy}
        className="rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-green disabled:opacity-60">
        {busy ? "Check Freighter…" : "Sign in"}
      </button>
      {error && <p role="alert" className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-oxblood/30 bg-oxblood-tint p-3 text-[13px] text-oxblood">{error}</p>}
    </div>
  );
}

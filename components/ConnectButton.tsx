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

  const onSignOut = async () => {
    await signOut();
    setAddress(null);
  };

  if (address) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="rounded-full border border-line px-3 py-1 font-mono" title={address}>{short(address)}</span>
        <button onClick={onSignOut} className="text-muted underline-offset-4 hover:underline">Sign out</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onSignIn}
        disabled={busy}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-strong disabled:opacity-60"
      >
        {busy ? "Check Freighter…" : "Sign in with Freighter"}
      </button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-danger">{error}</p>}
    </div>
  );
}

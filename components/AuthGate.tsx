"use client";

import { useState } from "react";
import { signIn, useSession } from "@/lib/wallet/session";
import { btn, ErrorBox, NightPanel } from "./ui";

/** Renders children with the signed-in address, or a sign-in prompt. */
export default function AuthGate({ title, intro, children }: { title: string; intro: string; children: (address: string) => React.ReactNode }) {
  const { address: me, loaded } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!loaded) return <div className="h-64 animate-pulse rounded-[var(--radius-slab)] bg-surface/60" aria-label="Loading" />;
  if (me) return <>{children(me)}</>;
  return (
    <NightPanel className="py-14 text-center sm:py-20">
      <h1 className="headline mx-auto max-w-xl text-[32px] sm:text-[48px]">{title}</h1>
      <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-white/65">{intro}</p>
      <button disabled={busy} className={btn.light + " mt-8"}
        onClick={() => { setBusy(true); setError(undefined); signIn().catch((e) => setError(e.message)).finally(() => setBusy(false)); }}>
        {busy ? "Check Freighter…" : "Sign in with Freighter"}
      </button>
      <p className="mt-4 text-[13px] text-white/45">Freighter must be set to Testnet.</p>
      {error && <div className="mx-auto mt-6 max-w-md text-left"><ErrorBox message={error} /></div>}
    </NightPanel>
  );
}

"use client";

import { useEffect, useState } from "react";
import { signIn, whoAmI } from "@/lib/wallet/session";
import { btn, ErrorBox } from "./ui";

/** Renders children with the signed-in address, or a sign-in prompt. */
export default function AuthGate({ title, intro, children }: { title: string; intro: string; children: (address: string) => React.ReactNode }) {
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  useEffect(() => { whoAmI().then(setMe).catch(() => setMe(null)); }, []);

  if (me === undefined) return <p className="text-muted">Loading…</p>;
  if (me) return <>{children(me)}</>;
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">{title}</h1>
      <p className="text-muted">{intro}</p>
      <button className={btn.primary} onClick={() => signIn().then(setMe).catch((e) => setError(e.message))}>Sign in with Freighter</button>
      <ErrorBox message={error} />
    </div>
  );
}

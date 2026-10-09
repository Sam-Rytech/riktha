"use client";

import { Asset } from "@stellar/stellar-sdk";
import { useCallback, useEffect, useState } from "react";
import { estateTransfer, NETWORK } from "@/lib/client/actions";
import { availableXlmStroops, type HorizonAccount } from "@/lib/core/state";
import { baseReserveStroops, explorerTxUrl, loadAccountRaw } from "@/lib/stellar/horizon";
import { connect } from "@/lib/wallet/freighter";
import { btn, Card, ErrorBox, short, Status } from "./ui";

interface Row { key: string; label: string; amount: string; asset: Asset; needsTrust: boolean }

const toAmount = (stroops: bigint) => {
  const s = stroops.toString().padStart(8, "0");
  return `${s.slice(0, -7)}.${s.slice(-7)}`;
};
const toStroops = (a: string) => {
  const [w, f = ""] = a.split(".");
  return BigInt(w) * 10_000_000n + BigInt((f + "0000000").slice(0, 7));
};

/** Lists the owner's classic balances and lets the heir move each one to their own account. */
export default function EstatePanel({ owner, heir }: { owner: string; heir: string }) {
  const [rows, setRows] = useState<Row[]>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [o, h, reserve] = await Promise.all([loadAccountRaw(NETWORK, owner), loadAccountRaw(NETWORK, heir), baseReserveStroops(NETWORK)]);
    if (!o) return setRows([]);
    const heirHas = (code?: string, issuer?: string) => !!h?.balances.some((b) => b.asset_code === code && b.asset_issuer === issuer);
    const out: Row[] = [];
    for (const b of (o as HorizonAccount).balances) {
      if (b.asset_type === "native") {
        const avail = availableXlmStroops(o, reserve);
        if (avail > 0n) out.push({ key: "native", label: "XLM", amount: toAmount(avail), asset: Asset.native(), needsTrust: false });
      } else if (b.asset_code && b.asset_issuer) {
        const amt = toStroops(b.balance) - toStroops(b.selling_liabilities ?? "0");
        if (amt > 0n) out.push({ key: `${b.asset_code}:${b.asset_issuer}`, label: b.asset_code, amount: toAmount(amt), asset: new Asset(b.asset_code, b.asset_issuer), needsTrust: !heirHas(b.asset_code, b.asset_issuer) });
      }
    }
    setRows(out);
  }, [owner, heir]);

  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  async function send(r: Row) {
    setError(undefined);
    setBusy(r.key);
    try {
      const me = await connect();
      if (me !== heir) throw new Error(`Switch Freighter to the heir account ${short(heir)} (connected: ${short(me)}).`);
      const hash = await estateTransfer(heir, owner, r.asset, r.amount, r.needsTrust);
      setDone((d) => ({ ...d, [r.key]: hash }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Card>
      <h2 className="font-serif text-xl">The estate</h2>
      <p className="mt-1 text-sm text-muted">
        Balances held by {short(owner)}. Each transfer is signed with your own key and pays its fee from your account.
        A small amount of XLM must stay behind as the account&apos;s minimum balance.
      </p>
      {rows === undefined && <p className="mt-4 text-sm text-muted">Loading balances…</p>}
      {rows?.length === 0 && Object.keys(done).length === 0 && <p className="mt-4 text-sm text-muted">Nothing left to move.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-mono text-sm">{r.amount} <b>{r.label}</b></p>
                {r.needsTrust && <p className="text-xs text-muted">Adds a trustline to your account first (costs 0.5 XLM reserve).</p>}
              </div>
              <button onClick={() => send(r)} disabled={busy !== undefined} className={btn.primary}>
                {busy === r.key ? "Check Freighter…" : "Send to me"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {Object.entries(done).map(([k, h]) => (
        <p key={k} className="mt-2 text-sm">✓ Moved {k === "native" ? "XLM" : k.split(":")[0]} · <a className={btn.link} href={explorerTxUrl(NETWORK, h)} target="_blank" rel="noreferrer">view transaction</a></p>
      ))}
      <Status text={busy ? "Waiting for Freighter and the network…" : undefined} />
      <ErrorBox message={error} />
    </Card>
  );
}

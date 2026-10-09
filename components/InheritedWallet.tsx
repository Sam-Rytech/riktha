"use client";

import { Asset, Keypair, StrKey } from "@stellar/stellar-sdk";
import { useCallback, useEffect, useState } from "react";
import { NETWORK } from "@/lib/client/actions";
import { inheritedSend } from "@/lib/client/kit";
import { availableXlmStroops } from "@/lib/core/state";
import { baseReserveStroops, explorerTxUrl, loadAccountRaw } from "@/lib/stellar/horizon";
import { btn, Card, ErrorBox, short, Status } from "./ui";

interface Bal { key: string; code: string; asset: Asset; sendable: string }
const FEE_MARGIN = 100_000n; // keep 0.01 XLM for this and later transaction fees

const toAmount = (stroops: bigint) => { const s = (stroops < 0n ? 0n : stroops).toString().padStart(8, "0"); return `${s.slice(0, -7)}.${s.slice(-7)}`.replace(/\.?0+$/, "") || "0"; };
const toStroops = (a: string) => { const [w, f = ""] = a.split("."); return BigInt(w || "0") * 10_000_000n + BigInt((f + "0000000").slice(0, 7)); };

/** After handover the owner's account *is* the heir's wallet (A§15): send any balance anywhere. */
export default function InheritedWallet({ heir, owner }: { heir: Keypair; owner: string }) {
  const [bals, setBals] = useState<Bal[]>();
  const [to, setTo] = useState("");
  const [assetKey, setAssetKey] = useState("native");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<{ hash: string; text: string }[]>([]);

  const load = useCallback(async () => {
    const [acc, reserve] = await Promise.all([loadAccountRaw(NETWORK, owner), baseReserveStroops(NETWORK)]);
    if (!acc) return setBals([]);
    const out: Bal[] = [];
    for (const b of acc.balances) {
      if (b.asset_type === "native") out.push({ key: "native", code: "XLM", asset: Asset.native(), sendable: toAmount(availableXlmStroops(acc, reserve) - FEE_MARGIN) });
      else if (b.asset_code && b.asset_issuer) out.push({ key: `${b.asset_code}:${b.asset_issuer}`, code: b.asset_code, asset: new Asset(b.asset_code, b.asset_issuer), sendable: toAmount(toStroops(b.balance) - toStroops(b.selling_liabilities ?? "0")) });
    }
    setBals(out);
  }, [owner]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const sel = bals?.find((b) => b.key === assetKey);
  const validTo = StrKey.isValidEd25519PublicKey(to.trim()) && to.trim() !== owner;
  const validAmount = !!sel && /^\d+(\.\d{1,7})?$/.test(amount) && toStroops(amount) > 0n && toStroops(amount) <= toStroops(sel.sendable);

  async function send() {
    if (!sel) return;
    setBusy(true); setError(undefined);
    try {
      const hash = await inheritedSend(heir, owner, to.trim(), sel.asset, amount, memo.trim());
      setSent((s) => [{ hash, text: `${amount} ${sel.code} to ${short(to.trim())}` }, ...s]);
      setAmount(""); setMemo(""); setReview(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-serif text-xl">The inheritance is yours</h2>
        <p className="mt-1 text-muted">
          You now control Stellar account <span className="font-mono" title={owner}>{short(owner)}</span>. Send its funds to a wallet
          or exchange account you use. Network fees (a fraction of a cent) come out of the account itself.
        </p>
        {bals === undefined ? <p className="mt-4 text-sm text-muted">Loading balances…</p> : (
          <ul className="mt-4 divide-y divide-line">
            {bals.map((b) => (
              <li key={b.key} className="flex justify-between py-2 text-sm">
                <span>{b.code}</span><span className="font-mono">{b.sendable} available</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {bals && bals.length > 0 && (
        <Card>
          <h2 className="font-serif text-xl">Send funds</h2>
          {!review ? (
            <form onSubmit={(e) => { e.preventDefault(); if (validTo && validAmount) setReview(true); }} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">To (a Stellar address starting with G)</span>
                <input value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} autoComplete="off" placeholder="G…"
                  aria-invalid={to !== "" && !validTo} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-sm focus:border-accent" />
                {to !== "" && !validTo && <span className="mt-1 block text-sm text-danger">Enter a valid Stellar address (56 characters, starting with G).</span>}
              </label>
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <label className="block">
                  <span className="text-sm font-medium">Asset</span>
                  <select value={assetKey} onChange={(e) => { setAssetKey(e.target.value); setAmount(""); }} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm">
                    {bals.map((b) => <option key={b.key} value={b.key}>{b.code}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Amount</span>
                  <div className="mt-1 flex gap-2">
                    <input value={amount} onChange={(e) => setAmount(e.target.value.trim())} inputMode="decimal" placeholder="0.00"
                      className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-sm focus:border-accent" />
                    <button type="button" onClick={() => sel && setAmount(sel.sendable)} className={btn.secondary}>Max</button>
                  </div>
                  {amount !== "" && !validAmount && <span className="mt-1 block text-sm text-danger">Enter an amount up to {sel?.sendable} {sel?.code}.</span>}
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Memo <span className="font-normal text-muted">(required by most exchanges; copy it from their deposit page)</span></span>
                <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={28} autoComplete="off"
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm focus:border-accent" />
              </label>
              <button type="submit" disabled={!validTo || !validAmount} className={btn.primary}>Review</button>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <p>Send <b className="font-mono">{amount} {sel?.code}</b> to <b className="font-mono break-all">{to.trim()}</b>{memo.trim() ? <> with memo <b className="font-mono">{memo.trim()}</b></> : null}?</p>
              <p className="text-sm text-muted">Stellar payments can&apos;t be reversed. Double-check the address and memo.</p>
              <div className="flex gap-3">
                <button onClick={() => setReview(false)} disabled={busy} className={btn.secondary}>Back</button>
                <button onClick={send} disabled={busy} className={btn.primary}>{busy ? "Sending…" : "Send now"}</button>
              </div>
            </div>
          )}
          <Status text={busy ? "Sending to the Stellar network…" : undefined} />
          <ErrorBox message={error} />
          {sent.map((s) => (
            <p key={s.hash} className="mt-2 text-sm">✓ Sent {s.text} · <a className={btn.link} href={explorerTxUrl(NETWORK, s.hash)} target="_blank" rel="noreferrer">view transaction</a></p>
          ))}
        </Card>
      )}
    </div>
  );
}

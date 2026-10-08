"use client";

// Spike SP6/SP7: can Freighter sign a PreconditionsV2 tx and a fee-bump envelope? Testnet only.
import { FeeBumpTransaction, Horizon, TransactionBuilder } from "@stellar/stellar-sdk";
import { useState } from "react";
import { buildCheckIn, buildPhase1, parseTx, wrapFeeBump } from "@/lib/core/builders";
import { NETWORKS } from "@/lib/core/config";
import { extractResultCodes } from "@/lib/core/errors";
import { assertNetwork, connect, signXdr } from "@/lib/wallet/freighter";

const NET = "testnet" as const;
const server = new Horizon.Server(NETWORKS[NET].horizon);

export default function SignTest() {
  const [address, setAddress] = useState<string>();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const say = (line: string) => setLog((l) => [...l, line]);

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const codes = extractResultCodes(e);
      say(`❌ ${(e as Error).message}${Object.keys(codes).length ? " " + JSON.stringify(codes) : ""}`);
    } finally {
      setBusy(false);
    }
  };

  const seq = async (addr: string) => BigInt((await server.loadAccount(addr)).sequenceNumber());

  const onConnect = run(async () => {
    const a = await connect();
    await assertNetwork(NET);
    setAddress(a);
    say(`Connected: ${a} (testnet)`);
  });

  const onFund = run(async () => {
    const r = await fetch(`${NETWORKS[NET].friendbot}?addr=${address}`);
    say(r.ok ? "✅ Funded with 10,000 test XLM" : `Friendbot: ${r.status} (already funded?)`);
  });

  const onSp6 = run(async () => {
    const tx = buildPhase1(NET, address!, (await seq(address!)) + 1n, 60);
    const signed = parseTx(NET, await signXdr(tx.toXDR(), NET, address));
    say(`SP6 ${signed.signatures.length === 1 ? "✅" : "❌"} Freighter signed a PreconditionsV2 tx (minSeqNum + minSeqAge); signatures: ${signed.signatures.length}. Not submitted.`);
  });

  const onSp7 = run(async () => {
    const inner = parseTx(NET, await signXdr(buildCheckIn(NET, address!, await seq(address!)).toXDR(), NET, address));
    say("Inner check-in signed. Now sign the fee-bump wrapper…");
    const fbXdr = await signXdr(wrapFeeBump(NET, address!, inner).toXDR(), NET, address);
    const fb = TransactionBuilder.fromXDR(fbXdr, NETWORKS[NET].passphrase);
    if (!(fb instanceof FeeBumpTransaction)) throw new Error("Freighter returned a non-fee-bump envelope");
    say(`Fee-bump signed (outer signatures: ${fb.signatures.length}). Submitting…`);
    const res = await server.submitTransaction(fb);
    say(`SP7 ✅ Freighter signs fee-bumps. Tx: ${NETWORKS[NET].explorer}/tx/${res.hash}`);
  });

  const btn = "rounded border border-stone-400 px-4 py-2 text-left disabled:opacity-40 hover:bg-stone-100";
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 font-mono text-sm">
      <h1 className="text-xl font-bold">Freighter signing spike (SP6 / SP7)</h1>
      <p>Set Freighter to <b>Testnet</b>. Run the steps in order.</p>
      <div className="flex flex-col gap-2">
        <button className={btn} disabled={busy} onClick={onConnect}>1. Connect Freighter</button>
        <button className={btn} disabled={busy || !address} onClick={onFund}>2. Fund my account (friendbot)</button>
        <button className={btn} disabled={busy || !address} onClick={onSp6}>3. SP6: sign a PreconditionsV2 tx</button>
        <button className={btn} disabled={busy || !address} onClick={onSp7}>4. SP7: sign + submit a fee-bump (2 prompts)</button>
      </div>
      <pre className="whitespace-pre-wrap rounded bg-stone-100 p-3">{log.join("\n") || "…"}</pre>
    </main>
  );
}

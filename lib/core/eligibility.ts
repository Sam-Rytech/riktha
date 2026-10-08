import { StrKey } from "@stellar/stellar-sdk";
import { MIN_WINDOWS, NetworkName, OWNER_BUFFER_STROOPS } from "./config";
import { availableXlmStroops, HorizonAccount } from "./state";

export interface OwnerCheck {
  ok: boolean;
  errors: string[];
  /** Weight W for pre-auth signers and the heir signer (A§2.3). */
  weight: number;
  /** Hex hashes of known stale Riktha pre-auth signers, to remove in the setup tx. */
  stalePreauthHashes: string[];
}

const preauthHex = (key: string) => Buffer.from(StrKey.decodePreAuthTx(key)).toString("hex");

/**
 * A§2.8. `knownRikthaHashes` are hashes from this owner's previous Riktha plans: those signers
 * may be present (re-arm). Any other extra signer means a multisig account, which isn't supported.
 */
export function checkOwnerAccount(
  account: HorizonAccount | null, baseReserveStroops: bigint, knownRikthaHashes: string[] = [],
): OwnerCheck {
  const errors: string[] = [];
  if (!account) return { ok: false, errors: ["This account doesn't exist on the selected network. Fund it first."], weight: 1, stalePreauthHashes: [] };

  const known = new Set(knownRikthaHashes);
  const stale: string[] = [];
  let masterWeight = 0;
  for (const s of account.signers) {
    if (s.key === account.account_id) masterWeight = s.weight;
    else if (s.type === "preauth_tx" && known.has(preauthHex(s.key))) stale.push(preauthHex(s.key));
    else if (s.weight > 0) errors.push("Accounts with extra signers (multisig) aren't supported yet.");
  }
  const { low_threshold, med_threshold, high_threshold } = account.thresholds;
  if (masterWeight < 1 || masterWeight < Math.max(low_threshold, med_threshold, high_threshold)) {
    errors.push("Your own key must be able to authorize everything on this account (custom thresholds aren't supported).");
  }

  // Setup adds 2 signers; removing stale ones frees their reserves.
  const available = availableXlmStroops(account, baseReserveStroops) + BigInt(stale.length) * baseReserveStroops;
  const needed = 2n * baseReserveStroops + OWNER_BUFFER_STROOPS;
  if (available < needed) {
    errors.push(`Keep at least ${formatXlm(needed)} XLM available (two signer reserves plus a 1 XLM buffer).`);
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    weight: Math.max(1, high_threshold),
    stalePreauthHashes: stale,
  };
}

export function checkHeirAccount(heir: string, owner: string, heirAccount: HorizonAccount | null): string[] {
  if (!StrKey.isValidEd25519PublicKey(heir)) return ["That isn't a valid Stellar address (it should start with G)."];
  if (heir === owner) return ["The heir must be a different account from yours."];
  if (!heirAccount) return ["The heir's account must exist and be funded on this network."];
  return [];
}

export function checkWindows(network: NetworkName, inactivitySeconds: number, graceSeconds: number): string[] {
  const min = MIN_WINDOWS[network];
  const errors: string[] = [];
  if (!Number.isInteger(inactivitySeconds) || inactivitySeconds < min.I) errors.push(`The inactivity window must be at least ${formatDuration(min.I)}.`);
  if (!Number.isInteger(graceSeconds) || graceSeconds < min.G) errors.push(`The grace window must be at least ${formatDuration(min.G)}.`);
  return errors;
}

export function formatXlm(stroops: bigint): string {
  const s = stroops.toString().padStart(8, "0");
  return `${s.slice(0, -7)}.${s.slice(-7)}`.replace(/\.?0+$/, "");
}

export function formatDuration(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400} day${seconds === 86_400 ? "" : "s"}`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hour${seconds === 3_600 ? "" : "s"}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `${seconds} seconds`;
}

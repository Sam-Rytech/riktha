import { Networks } from "@stellar/stellar-sdk";

export type NetworkName = "testnet" | "mainnet";

export const NETWORKS: Record<NetworkName, { passphrase: string; horizon: string; friendbot?: string; explorer: string }> = {
  testnet: {
    passphrase: Networks.TESTNET,
    horizon: "https://horizon-testnet.stellar.org",
    friendbot: "https://friendbot.stellar.org",
    explorer: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    passphrase: Networks.PUBLIC,
    horizon: "https://horizon.stellar.org",
    explorer: "https://stellar.expert/explorer/public",
  },
};

/** Mainnet is disabled for the hackathon submission (PRD §5). */
export const ENABLED_NETWORKS: NetworkName[] = ["testnet"];

/** Distance between the owner's post-setup sequence X and Phase 1's sequence s1 (A§2.3). Confirmed by spike SP1. */
export const SEQ_JUMP = 1_000_000_000n;

const DAY = 86_400;
export const PRESETS = {
  demo: { label: "Demo (2 min / 2 min)", I: 120, G: 120, testnetOnly: true },
  d90: { label: "90 days", I: 90 * DAY, G: 30 * DAY, testnetOnly: false },
  d180: { label: "180 days", I: 180 * DAY, G: 30 * DAY, testnetOnly: false },
  d365: { label: "365 days", I: 365 * DAY, G: 30 * DAY, testnetOnly: false },
} as const;
export type PresetName = keyof typeof PRESETS;

export const MIN_WINDOWS: Record<NetworkName, { I: number; G: number }> = {
  testnet: { I: 60, G: 60 },
  mainnet: { I: 30 * DAY, G: 7 * DAY },
};

export const MEMOS = {
  notice: "riktha:notice",
  handover: "riktha:handover",
  alive: "riktha:alive",
} as const;

/** Setup / check-in / revoke are signed right away, so they get a short validity window. */
export const SIGN_TIMEOUT_SECONDS = 300;
/** Default per-op base fee for fee-bump wrappers, in stroops. */
export const FEE_BUMP_BASE_FEE = "1000";
/** Extra XLM an owner must keep beyond the reserves Riktha adds (A§2.8). */
export const OWNER_BUFFER_STROOPS = 10_000_000n;
export const STROOPS_PER_XLM = 10_000_000n;

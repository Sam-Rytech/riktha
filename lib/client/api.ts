"use client";

import type { ExplainedTx } from "@/lib/core/explain";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly details: string[] = []) { super(message); }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(path, {
    cache: "no-store",
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.details ?? []);
  return body as T;
}

/** Shape returned by GET /api/plans/:id (see lib/server/plans.ts planWithState). */
export interface PlanView {
  id: string; role: "owner" | "heir"; network: string; owner: string; heir: string; heirEmail?: string | null;
  variant: "plain" | "sponsored"; inactivitySeconds: number; graceSeconds: number; version: number;
  createdAt: string; setupTxHash: string | null; phase1Seq: string; phase1Hash: string; phase2Hash: string;
  phase1Xdr: string; phase2Xdr: string; state: string; seqTime?: number; eligibleAt?: number; claimableAt?: number;
  ownerCanPayFee?: boolean; diagnostics: string[];
  balances?: { asset_type: string; balance: string; asset_code?: string; asset_issuer?: string }[];
}

export interface Draft {
  planId: string; setupXdr: string; removesStaleSigners: number;
  explain: { setup: ExplainedTx; phase1: ExplainedTx; phase2: ExplainedTx };
}

export interface InboxItem { id: string; planId: string; kind: string; title: string | null; body: string | null; urgent: boolean; sentAt: string; readAt: string | null }

/** Confirm a submitted setup; Horizon can lag a ledger behind, so 409s are retried. */
export async function confirmPlan(planId: string, txHash: string): Promise<{ state: string; eligibleAt?: number }> {
  for (let i = 0; i < 8; i++) {
    try {
      return await api(`/api/plans/${planId}/confirm`, { method: "POST", json: { txHash } });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 409 || i === 7) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("unreachable");
}

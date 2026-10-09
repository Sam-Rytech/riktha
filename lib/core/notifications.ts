// Which notifications are due for a plan, given its cached and freshly derived state (A§9). Pure.
import type { DerivedState, PlanState } from "./state";

export type NotificationKind =
  | "ARMED_OWNER" | "ARMED_HEIR"
  | "REMIND_50" | "REMIND_80" | "REMIND_95"
  | "NOTICE_OWNER" | "NOTICE_HEIR"
  | "GRACE_50" | "GRACE_90"
  | "CLAIMABLE_HEIR"
  | "INHERITED_OWNER" | "INHERITED_HEIR"
  | "CANCELLED_OWNER" | "CANCELLED_HEIR";

export type Recipient = "owner" | "heir";
export interface Due { kind: NotificationKind; to: Recipient; cycle: number }

const REMINDERS: [number, NotificationKind][] = [[0.95, "REMIND_95"], [0.8, "REMIND_80"], [0.5, "REMIND_50"]];
const GRACE: [number, NotificationKind][] = [[0.9, "GRACE_90"], [0.5, "GRACE_50"]];

/** Highest threshold reached only: a late tick shouldn't send 50%, 80% and 95% at once. */
function highest(ratio: number, table: [number, NotificationKind][]): NotificationKind | undefined {
  return table.find(([t]) => ratio >= t)?.[1];
}

export const RECIPIENT: Record<NotificationKind, Recipient> = {
  ARMED_OWNER: "owner", ARMED_HEIR: "heir", REMIND_50: "owner", REMIND_80: "owner", REMIND_95: "owner",
  NOTICE_OWNER: "owner", NOTICE_HEIR: "heir", GRACE_50: "owner", GRACE_90: "owner", CLAIMABLE_HEIR: "heir",
  INHERITED_OWNER: "owner", INHERITED_HEIR: "heir", CANCELLED_OWNER: "owner", CANCELLED_HEIR: "heir",
};
export const URGENT = new Set<NotificationKind>(["NOTICE_OWNER", "GRACE_50", "GRACE_90"]);

const ENTERING: Partial<Record<PlanState, NotificationKind[]>> = {
  ARMED: ["ARMED_OWNER", "ARMED_HEIR"],
  NOTICE: ["NOTICE_OWNER", "NOTICE_HEIR"],
  CLAIMABLE: ["CLAIMABLE_HEIR"],
  INHERITED: ["INHERITED_OWNER", "INHERITED_HEIR"],
  CANCELLED: ["CANCELLED_OWNER", "CANCELLED_HEIR"],
};

/** plan_events type recorded when a plan enters a state. */
export const TRANSITION_EVENT: Partial<Record<PlanState, string>> = {
  NOTICE: "PHASE1", INHERITED: "PHASE2", CANCELLED: "CANCELLED", REVOKED: "REVOKED", BROKEN: "BROKEN",
};

const isPreNotice = (s: string) => s === "DRAFT" || s === "ARMED" || s === "ELIGIBLE";

export function dueNotifications(
  prev: string, d: DerivedState, windows: { inactivitySeconds: number; graceSeconds: number }, now: number,
): Due[] {
  const kinds: NotificationKind[] = [];
  const entered = prev !== d.state && !(d.state === "ELIGIBLE" && prev === "ARMED") && !(d.state === "ARMED" && prev === "ELIGIBLE");
  if (entered) {
    // A missed tick can jump straight from ARMED to CLAIMABLE: still send the notice alerts.
    if (d.state === "CLAIMABLE" && isPreNotice(prev)) kinds.push(...ENTERING.NOTICE!);
    kinds.push(...(ENTERING[d.state] ?? []));
  }
  const elapsed = now - d.seqTime;
  if (d.state === "ARMED" || d.state === "ELIGIBLE") {
    const k = highest(elapsed / windows.inactivitySeconds, REMINDERS);
    if (k) kinds.push(k);
  }
  if (d.state === "NOTICE") {
    const k = highest(elapsed / windows.graceSeconds, GRACE);
    if (k) kinds.push(k);
  }
  return kinds.map((kind) => ({ kind, to: RECIPIENT[kind], cycle: d.seqTime }));
}

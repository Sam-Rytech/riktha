import { describe, expect, it } from "vitest";
import { dueNotifications } from "@/lib/core/notifications";
import type { DerivedState, PlanState } from "@/lib/core/state";

const W = { inactivitySeconds: 100, graceSeconds: 50 };
const T = 1_000;
const d = (state: PlanState, seqTime = T): DerivedState => ({ state, seq: 1n, seqTime, ownerCanPayFee: true, diagnostics: [] });
const kinds = (prev: string, st: DerivedState, now: number) => dueNotifications(prev, st, W, now).map((x) => x.kind);

describe("dueNotifications", () => {
  it("nothing early in the window", () => {
    expect(kinds("ARMED", d("ARMED"), T + 10)).toEqual([]);
  });
  it("50% / 80% / 95% reminders, highest only", () => {
    expect(kinds("ARMED", d("ARMED"), T + 50)).toEqual(["REMIND_50"]);
    expect(kinds("ARMED", d("ARMED"), T + 85)).toEqual(["REMIND_80"]);
    expect(kinds("ARMED", d("ARMED"), T + 99)).toEqual(["REMIND_95"]);
  });
  it("ARMED <-> ELIGIBLE is not a transition", () => {
    expect(kinds("ARMED", d("ELIGIBLE"), T + 120)).toEqual(["REMIND_95"]);
    expect(kinds("ELIGIBLE", d("ARMED", T + 200), T + 201)).toEqual([]);
  });
  it("entering NOTICE alerts both, then grace reminders", () => {
    expect(kinds("ELIGIBLE", d("NOTICE"), T + 1)).toEqual(["NOTICE_OWNER", "NOTICE_HEIR"]);
    expect(kinds("NOTICE", d("NOTICE"), T + 30)).toEqual(["GRACE_50"]);
    expect(kinds("NOTICE", d("NOTICE"), T + 46)).toEqual(["GRACE_90"]);
  });
  it("jumping straight to CLAIMABLE still sends notice alerts", () => {
    expect(kinds("ARMED", d("CLAIMABLE"), T + 60)).toEqual(["NOTICE_OWNER", "NOTICE_HEIR", "CLAIMABLE_HEIR"]);
    expect(kinds("NOTICE", d("CLAIMABLE"), T + 60)).toEqual(["CLAIMABLE_HEIR"]);
  });
  it("INHERITED and CANCELLED alert both", () => {
    expect(kinds("CLAIMABLE", d("INHERITED"), T)).toEqual(["INHERITED_OWNER", "INHERITED_HEIR"]);
    expect(kinds("NOTICE", d("CANCELLED"), T)).toEqual(["CANCELLED_OWNER", "CANCELLED_HEIR"]);
  });
  it("recipients and cycle", () => {
    const due = dueNotifications("ELIGIBLE", d("NOTICE", 4242), W, 4243);
    expect(due).toEqual([{ kind: "NOTICE_OWNER", to: "owner", cycle: 4242 }, { kind: "NOTICE_HEIR", to: "heir", cycle: 4242 }]);
  });
  it("steady terminal states send nothing", () => {
    expect(kinds("INHERITED", d("INHERITED"), T + 999)).toEqual([]);
    expect(kinds("CANCELLED", d("CANCELLED"), T + 999)).toEqual([]);
  });
});

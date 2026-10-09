import { describe, expect, it } from "vitest";
import type { NotificationKind } from "@/lib/core/notifications";
import { isReservedAddress } from "@/lib/server/notify/reserved";
import { render, toEmail } from "@/lib/server/notify/templates";

const KINDS: NotificationKind[] = [
  "ARMED_OWNER", "ARMED_HEIR", "REMIND_50", "REMIND_80", "REMIND_95", "NOTICE_OWNER", "NOTICE_HEIR",
  "GRACE_50", "GRACE_90", "CLAIMABLE_HEIR", "INHERITED_OWNER", "INHERITED_HEIR", "CANCELLED_OWNER", "CANCELLED_HEIR",
];
const ctx = { appUrl: "https://riktha.vercel.app", owner: "G".padEnd(56, "A"), heir: "G".padEnd(56, "B"), inactivitySeconds: 120, graceSeconds: 120, eligibleAt: 1_800_000_000, claimableAt: 1_800_000_120 };

describe("email templates (deliverability)", () => {
  it.each(KINDS)("%s: no shouting, one link, plain-text part, reason footer", (kind) => {
    const mail = toEmail(render(kind, ctx), kind.startsWith("NOTICE") || kind.startsWith("GRACE"));
    expect(mail.subject).not.toMatch(/urgent/i);
    expect(mail.html).not.toMatch(/urgent/i);
    expect((mail.html.match(/<a /g) ?? []).length).toBeLessThanOrEqual(1);
    expect(mail.text).toContain("You're receiving this because");
    expect(mail.text.length).toBeGreaterThan(80);
  });
  it("escapes HTML in content", () => {
    expect(toEmail({ title: "<b>x</b>", body: "a & b" }, false).html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});


describe("reserved test addresses", () => {
  it("skips RFC 2606 domains but not real ones", () => {
    for (const a of ["heir@example.com", "x@mail.example.org", "a@foo.test", "b@bar.invalid"]) expect(isReservedAddress(a)).toBe(true);
    for (const a of ["someone@gmail.com", "me@example.co.uk", "x@testing.com"]) expect(isReservedAddress(a)).toBe(false);
  });
});

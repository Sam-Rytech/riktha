"use client";

import Link from "next/link";
import type { InboxItem } from "@/lib/client/api";
import { btn, Card } from "./ui";

export default function Inbox({ items }: { items: InboxItem[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Notifications</h2>
        <Link href="/settings" className={btn.link}>Channels</Link>
      </div>
      {items.length === 0 ? <p className="mt-3 text-[15px] text-muted">Nothing yet. Reminders and alerts appear here, and by email and Telegram if you link them in Settings.</p> : (
        <ul className="mt-4 space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-2xl px-4 py-3 ${n.urgent ? "bg-oxblood-tint" : "bg-stone"}`}>
              <p className={`flex items-center gap-2 text-[15px] font-medium ${n.urgent ? "text-oxblood" : ""}`}>
                {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-green" aria-label="unread" />}{n.title}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{n.body}</p>
              <p className="mt-1 font-mono text-[12px] text-muted">{new Date(n.sentAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

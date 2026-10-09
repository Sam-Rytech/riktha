"use client";

import Link from "next/link";
import type { InboxItem } from "@/lib/client/api";
import { btn, Card } from "./ui";

export default function Inbox({ items }: { items: InboxItem[] }) {
  return (
    <Card>
      <h2 className="font-serif text-xl">Notifications</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing yet. Reminders and alerts appear here, and by email and Telegram if you link them in <Link className={btn.link} href="/settings">Settings</Link>.</p> : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className="py-3">
              <p className={`text-sm font-medium ${n.urgent ? "text-danger" : ""}`}>{!n.readAt && <span className="mr-1" aria-label="unread">•</span>}{n.title}</p>
              <p className="mt-0.5 text-sm text-muted">{n.body}</p>
              <p className="mt-0.5 text-xs text-muted">{new Date(n.sentAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

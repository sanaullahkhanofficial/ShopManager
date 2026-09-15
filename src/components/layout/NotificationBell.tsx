import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type { AppNotification } from "../../types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    api.notificationsRefresh().then((n) => setItems(n as AppNotification[]));
    api.notificationsUnreadCount().then((c) => setUnread(c as number));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(id: number) {
    await api.notificationsMarkRead(id);
    setItems((v) => v.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    setUnread((c) => Math.max(0, c - 1));
  }
  async function markAllRead() {
    await api.notificationsMarkAllRead();
    setItems((v) => v.map((n) => ({ ...n, is_read: 1 })));
    setUnread(0);
  }

  const severityDot: Record<AppNotification["severity"], string> = {
    info: "bg-blue-400",
    warning: "bg-amber-500",
    critical: "bg-red-500",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:bg-stone-50"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-card border border-stone-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
            <span className="text-sm font-semibold text-brand-navy-900">Notifications</span>
            <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-brand-green-700 hover:underline">
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone-400">No notifications</p>}
            {items.map((n) => (
              <div key={n.id} className={`flex gap-2 border-b border-stone-50 px-3 py-2 text-sm ${n.is_read ? "opacity-60" : ""}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[n.severity]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-800">{n.title}</p>
                  <p className="truncate text-xs text-stone-500">{n.body}</p>
                  <p className="text-[11px] text-stone-400">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="shrink-0 text-stone-400 hover:text-brand-green-700" title="Mark read">
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

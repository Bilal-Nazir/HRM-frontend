"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  readAt?: string;
  createdAt: string;
};

type NotificationInbox = {
  notifications: Notification[];
  unreadCount: number;
};

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function NotificationCenter({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { data, error, refresh } = useLiveData<NotificationInbox>("/notifications?size=15");
  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const destination = (href: string) => {
    if (!isAdmin || href.startsWith("/admin")) return href;
    return `/admin${href}`;
  };

  const visit = async (notification: Notification) => {
    if (!notification.readAt) await api.patch(`/notifications/${notification.id}/read`);
    setOpen(false);
    refresh();
    router.push(destination(notification.href));
  };

  const markAllRead = async () => {
    await api.patch("/notifications/read-all");
    refresh();
  };

  return (
    <div className="notification-center" ref={root}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={`${unreadCount} unread notifications`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} />
        {unreadCount > 0 && <strong>{unreadCount > 99 ? "99+" : unreadCount}</strong>}
      </button>
      {open && (
        <section className="notification-panel" aria-label="Notifications">
          <header>
            <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
            {unreadCount > 0 && <button type="button" onClick={markAllRead}><CheckCheck size={16} /> Mark all read</button>}
          </header>
          <div className="notification-list">
            {error && <p className="notification-empty">Notifications are temporarily unavailable.</p>}
            {!error && !data && <p className="notification-empty">Loading notifications…</p>}
            {!error && data && !notifications.length && <p className="notification-empty">You’re all caught up.</p>}
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notification-item ${notification.readAt ? "" : "unread"}`}
                onClick={() => visit(notification)}
              >
                <span className="notification-dot" />
                <span className="notification-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <small>{relativeTime(notification.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

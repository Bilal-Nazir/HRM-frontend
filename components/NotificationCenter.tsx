"use client";

import { Bell, CheckCheck, Volume2, VolumeX } from "lucide-react";
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

const playChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
    [659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.11);
      oscillator.stop(context.currentTime + 0.42 + index * 0.11);
    });
    window.setTimeout(() => void context.close(), 800);
  } catch {
    // Browsers may block audio until the user has interacted with the page.
  }
};

export default function NotificationCenter({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const previousUnreadIds = useRef<Set<string> | null>(null);
  const userInteracted = useRef(false);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { data, error, refresh } = useLiveData<NotificationInbox>("/notifications?size=15", 10000);
  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem("hrm_notification_sound") !== "off");
    const unlock = () => { userInteracted.current = true; };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  useEffect(() => {
    if (!data) return;
    const current = new Set(data.notifications.filter((item) => !item.readAt).map((item) => item.id));
    if (previousUnreadIds.current && soundEnabled && userInteracted.current && [...current].some((id) => !previousUnreadIds.current!.has(id))) playChime();
    previousUnreadIds.current = current;
  }, [data, soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("hrm_notification_sound", next ? "on" : "off");
    userInteracted.current = true;
    if (next) playChime();
  };

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
            <div className="notification-actions"><button type="button" onClick={toggleSound} title={soundEnabled ? "Mute notification sound" : "Enable notification sound"} aria-label={soundEnabled ? "Mute notification sound" : "Enable notification sound"}>{soundEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>{unreadCount > 0 && <button type="button" onClick={markAllRead}><CheckCheck size={16} /> Mark all read</button>}</div>
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

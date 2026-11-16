"use client";
import Link from "next/link";
import { AtSign, ArrowUpRight, Hash, MessageSquare, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatInbox } from "@/components/ChatProvider";
import { chatHref } from "@/lib/chat";
import Avatar from "@/components/Avatar";

export default function ChatLauncher({ isAdmin }: { isAdmin: boolean }) {
  const { inbox, error } = useChatInbox();
  const [open, setOpen] = useState(false),
    [mentions, setMentions] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const count = inbox?.unreadConversations || 0,
    mentionCount = inbox?.mentionCount || 0;
  const rows = (inbox?.conversations || [])
    .filter((row) => !mentions || !!row.mentionCount)
    .slice(0, 7);
  return (
    <div className="chat-launcher" ref={root}>
      <button
        className="chat-top-trigger"
        type="button"
        aria-label={`Chat: ${count} unread conversations, ${mentionCount} unread group mentions`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MessageSquare size={20} />
        {count > 0 && (
          <strong className="chat-top-unread">
            {count > 99 ? "99+" : count}
          </strong>
        )}
        {mentionCount > 0 && (
          <span className="chat-top-mentions">
            @{mentionCount > 99 ? "99+" : mentionCount}
          </span>
        )}
      </button>
      {open && (
        <section className="chat-popover" aria-label="Chat inbox">
          <header>
            <div>
              <strong>Messages</strong>
              <span>
                {count} unread chats · {mentionCount} mentions
              </span>
            </div>
            <Link
              href={`${chatHref(undefined, isAdmin)}?new=1`}
              aria-label="New conversation"
              onClick={() => setOpen(false)}
            >
              <Plus size={19} />
            </Link>
          </header>
          <div className="chat-popover-tabs">
            <button
              className={!mentions ? "active" : ""}
              onClick={() => setMentions(false)}
            >
              All messages
            </button>
            <button
              className={mentions ? "active" : ""}
              onClick={() => setMentions(true)}
            >
              <AtSign size={14} />
              Mentions {mentionCount > 0 ? `(${mentionCount})` : ""}
            </button>
          </div>
          {error && (
            <p className="chat-popover-empty">
              Chat is temporarily unavailable.
            </p>
          )}
          {!inbox && !error && (
            <p className="chat-popover-empty">Loading messages…</p>
          )}
          {inbox && !rows.length && (
            <p className="chat-popover-empty">
              {mentions
                ? "No unread group mentions."
                : "Start a conversation with your team."}
            </p>
          )}
          <div className="chat-popover-list">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={chatHref(row.id, isAdmin, mentions)}
                className={row.unreadCount ? "unread" : ""}
                onClick={() => setOpen(false)}
              >
                <span className="chat-avatar">
                  {row.kind === "project" ? (
                    <Hash size={19} />
                  ) : (
                    <Avatar
                      className="chat-avatar"
                      userId={row.otherUserId}
                      version={row.photoVersion}
                      name={row.title}
                    />
                  )}
                </span>
                <span className="chat-popover-copy">
                  <strong>{row.title}</strong>
                  <small>{row.lastMessage || "No messages yet"}</small>
                </span>
                {!!row.mentionCount && (
                  <span className="chat-mention-badge">
                    @{row.mentionCount}
                  </span>
                )}
                {!!row.unreadCount && (
                  <b className="chat-count">{row.unreadCount}</b>
                )}
              </Link>
            ))}
          </div>
          <Link
            className="chat-view-all"
            href={chatHref(undefined, isAdmin)}
            onClick={() => setOpen(false)}
          >
            Open chat
            <ArrowUpRight size={16} />
          </Link>
        </section>
      )}
    </div>
  );
}

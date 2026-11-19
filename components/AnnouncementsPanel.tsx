"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import { AnnouncementList } from "@/types/workspace";
import { portalPrefix } from "@/lib/access";
import { getSession } from "@/lib/auth";

export default function AnnouncementsPanel({
  admin = false,
  compact = true,
  unreadOnly = false,
}: {
  admin?: boolean;
  compact?: boolean;
  unreadOnly?: boolean;
}) {
  const [data, setData] = useState<AnnouncementList | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [readKeys, setReadKeys] = useState<string[]>([]);
  const [readsReady, setReadsReady] = useState(false);
  useEffect(() => {
    const key = `hrm_read_announcements_${getSession()?.userId || "guest"}`;
    const sync = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "[]");
        setReadKeys(
          Array.isArray(saved)
            ? saved.filter((item): item is string => typeof item === "string")
            : [],
        );
      } catch {
        setReadKeys([]);
      }
      setReadsReady(true);
    };
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null) sync();
    };
    sync();
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setRetry((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const markRead = (key: string) => {
    const next = [...new Set([...readKeys, key])];
    setReadKeys(next);
    try {
      localStorage.setItem(
        `hrm_read_announcements_${getSession()?.userId || "guest"}`,
        JSON.stringify(next),
      );
    } catch {
      /* Keep the dismissal for this visit when storage is unavailable. */
    }
  };
  const onlyUnread = unreadOnly && !admin;
  const visibleItems =
    data?.announcements.filter(
      (item) =>
        !onlyUnread || !readKeys.includes(`${item.id}:${item.updatedAt}`),
    ) || [];
  const unread =
    data?.announcements.filter(
      (item) => !readKeys.includes(`${item.id}:${item.updatedAt}`),
    ).length || 0;
  const readVersion = onlyUnread ? JSON.stringify(readKeys) : "";
  useEffect(() => {
    if (onlyUnread && !readsReady) return;
    let cancelled = false;
    setError("");
    // Backfill the preview with older unread posts instead of letting read posts
    // on page one hide announcements further down the feed.
    const load = async () => {
      let result = await api.get<AnnouncementList>(
        `/announcements?page=${onlyUnread ? 1 : page}&size=${onlyUnread ? 50 : compact ? 3 : 10}`,
      );
      if (!onlyUnread) return result;
      let items = result.announcements.filter(
        (item) => !readKeys.includes(`${item.id}:${item.updatedAt}`),
      );
      for (
        let nextPage = 2;
        !cancelled && items.length < 3 && nextPage <= result.lastPage;
        nextPage++
      ) {
        const next = await api.get<AnnouncementList>(
          `/announcements?page=${nextPage}&size=50`,
        );
        items = [
          ...items,
          ...next.announcements.filter(
            (item) => !readKeys.includes(`${item.id}:${item.updatedAt}`),
          ),
        ];
      }
      return { ...result, announcements: items.slice(0, 3) };
    };
    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, retry, compact, onlyUnread, readsReady, readVersion]);
  if (
    onlyUnread &&
    readsReady &&
    data &&
    !loading &&
    !error &&
    visibleItems.length === 0
  )
    return null;
  return (
    <section className="card announcements-panel" aria-busy={loading}>
      <div className="card-header">
        <div className="announcement-heading">
          {!compact && (
            <span className="announcement-icon">
              <Megaphone size={21} />
            </span>
          )}
          <div>
            <h2>
              Announcements{" "}
              {!admin && unread > 0 && (
                <span
                  className="announcement-new-count"
                  aria-label={`${unread} new announcements`}
                >
                  {unread} new
                </span>
              )}
            </h2>
          </div>
        </div>
        {compact && (
          <Link
            className="button button-secondary"
            href={`${portalPrefix(getSession())}/announcements`}
          >
            {admin ? "Manage" : "View all"}
          </Link>
        )}
      </div>
      <div className="announcement-items" aria-live="polite">
        {loading ? (
          <p className="content-note">Loading announcements…</p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              className="button button-secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : !visibleItems.length ? (
          <div className="announcement-empty">
            <strong>You're all caught up.</strong>
            <p>
              {admin
                ? "Publish an announcement to share news with everyone."
                : "Updates from your admin will appear here."}
            </p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <article
              className={`announcement-item ${!admin && !readKeys.includes(`${item.id}:${item.updatedAt}`) ? "announcement-unread" : ""}`}
              key={item.id}
            >
              <div className="announcement-title">
                <h3>{item.title}</h3>
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </time>
              </div>
              <div className="content-prose">
                {compact && item.content.length > 240 ? (
                  <details>
                    <summary>
                      {item.content.slice(0, 160)}… <span>Read more</span>
                    </summary>
                    <p>{item.content}</p>
                  </details>
                ) : (
                  item.content
                )}
              </div>
              {!admin && !readKeys.includes(`${item.id}:${item.updatedAt}`) && (
                <button
                  type="button"
                  className="announcement-read-button"
                  onClick={() => markRead(`${item.id}:${item.updatedAt}`)}
                >
                  Mark as read
                </button>
              )}
            </article>
          ))
        )}
      </div>
      {!compact && data && data.lastPage > 1 && (
        <div className="content-pagination">
          <button
            className="button button-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {data.lastPage}
          </span>
          <button
            className="button button-secondary"
            disabled={page >= data.lastPage || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
      <div className="announcement-footer">
        <Link href={`${portalPrefix(getSession())}/terms`}>
          Company Policies
        </Link>
      </div>
    </section>
  );
}

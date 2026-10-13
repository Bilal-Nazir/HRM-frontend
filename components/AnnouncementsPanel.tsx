"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import { AnnouncementList } from "@/types/workspace";
import { getSession } from "@/lib/auth";

export default function AnnouncementsPanel({
  admin = false,
  compact = true,
}: {
  admin?: boolean;
  compact?: boolean;
}) {
  const [data, setData] = useState<AnnouncementList | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [readKeys, setReadKeys] = useState<string[]>([]);
  useEffect(() => { const key = `hrm_read_announcements_${getSession()?.userId || "guest"}`; try { setReadKeys(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setReadKeys([]); } }, []);
  useEffect(() => { const timer = setInterval(() => setRetry((value) => value + 1), 30000); return () => clearInterval(timer); }, []);
  const markRead = (key: string) => { const next = [...new Set([...readKeys, key])]; setReadKeys(next); localStorage.setItem(`hrm_read_announcements_${getSession()?.userId || "guest"}`, JSON.stringify(next)); };
  const unread = data?.announcements.filter((item) => !readKeys.includes(`${item.id}:${item.updatedAt}`)).length || 0;
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<AnnouncementList>(
        `/announcements?page=${page}&size=${compact ? 3 : 10}`,
      )
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
  }, [page, retry, compact]);
  return (
    <section className="card announcements-panel" aria-busy={loading}>
      <div className="card-header">
        <div className="announcement-heading">
          <span className="announcement-icon">
            <Megaphone size={21} />
          </span>
          <div>
            <span className="section-kicker">From your admin</span>
            <h2>Announcements {!admin && unread > 0 && <span className="announcement-new-count" aria-label={`${unread} new announcements`}>{unread} new</span>}</h2>
          </div>
        </div>
        {compact && (
          <Link
            className="button button-secondary"
            href={admin ? "/admin/announcements" : "/announcements"}
          >
            {admin ? "Manage" : "View all"}
            <ArrowUpRight size={15} />
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
        ) : !data?.announcements.length ? (
          <div className="announcement-empty">
            <strong>You're all caught up.</strong>
            <p>
              {admin
                ? "Publish an announcement to share news with everyone."
                : "Updates from your admin will appear here."}
            </p>
          </div>
        ) : (
          data.announcements.map((item) => (
            <article className={`announcement-item ${!admin && !readKeys.includes(`${item.id}:${item.updatedAt}`) ? "announcement-unread" : ""}`} key={item.id}>
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
              {!admin && !readKeys.includes(`${item.id}:${item.updatedAt}`) && <button type="button" className="announcement-read-button" onClick={() => markRead(`${item.id}:${item.updatedAt}`)}>Mark as read</button>}
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
        <Link href={admin ? "/admin/terms" : "/terms"}>
          Terms &amp; Conditions <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}

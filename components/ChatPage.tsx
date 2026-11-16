"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  AtSign,
  Check,
  CheckCheck,
  Hash,
  Loader2,
  MessageSquare,
  Plus,
  Reply,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import ChatCompanyGate from "@/components/ChatCompanyGate";
import { useChatInbox } from "@/components/ChatProvider";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  chatDay,
  chatHref,
  ChatConversation,
  ChatMessage,
  ChatPerson,
  ChatProject,
  chatTime,
  filterChatPeople,
} from "@/lib/chat";
import { errorMessage } from "@/lib/workspace";

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function MessageBody({ message }: { message: ChatMessage }) {
  const names = message.mentions
    .map((person) => `@${person.name}`)
    .sort((a, b) => b.length - a.length);
  const expression = new RegExp(
    `(https?:\\/\\/[^\\s]+${names.length ? `|${names.map(escapeRegex).join("|")}` : ""})`,
    "g",
  );
  return (
    <>
      {message.body.split(expression).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : names.includes(part) ? (
          <mark key={index}>{part}</mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function ChatWorkspace() {
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams();
  const admin = pathname.startsWith("/admin"),
    prefix = admin ? "/admin" : "";
  const conversationId = query.get("conversation") || "",
    projectId = query.get("project");
  const mentionView = query.get("mentions") === "1";
  const { inbox, error: inboxError, refresh } = useChatInbox();
  const [userId, setUserId] = useState(""),
    [scope, setScope] = useState("");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [picker, setPicker] = useState(false),
    [pickerTab, setPickerTab] = useState("people"),
    [directorySearch, setDirectorySearch] = useState("");
  const [directory, setDirectory] = useState<{
    people: ChatPerson[];
    projects: ChatProject[];
  }>({ people: [], projects: [] });
  const [detail, setDetail] = useState<{
    conversation: ChatConversation;
    people: ChatPerson[];
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(false),
    [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState(""),
    [mentionedIds, setMentionedIds] = useState<string[]>([]),
    [reply, setReply] = useState<ChatMessage | null>(null);
  const [mentionQuery, setMentionQuery] = useState<{
      start: number;
      end: number;
      query: string;
    } | null>(null),
    [mentionIndex, setMentionIndex] = useState(0);
  const [error, setError] = useState(""),
    [sendError, setSendError] = useState(""),
    [sending, setSending] = useState(false),
    [starting, setStarting] = useState(false),
    [membersOpen, setMembersOpen] = useState(false),
    [newBelow, setNewBelow] = useState(false);
  const list = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    directoryInput = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true),
    readIds = useRef(new Set<string>()),
    sendLock = useRef(false),
    startLock = useRef(false);
  const requestKey = useRef<{ signature: string; key: string } | null>(null),
    activeRoom = useRef(conversationId);
  const exhaustedHistory = useRef(false),
    activeView = useRef("");
  const messageCache = useRef<ChatMessage[]>([]);
  messageCache.current = messages;
  activeRoom.current = conversationId;
  activeView.current = `${conversationId}:${mentionView}`;
  const refreshMessages = useRef<() => void>(() => {});
  useEffect(() => {
    const user = getSession();
    if (user) {
      setUserId(user.userId);
      setScope(`${user.organizationId}:${user.userId}`);
    }
  }, []);
  useEffect(() => {
    if (query.get("new") === "1") setPicker(true);
  }, [query]);
  useEffect(() => {
    if (picker) {
      setDirectorySearch("");
      requestAnimationFrame(() => directoryInput.current?.focus());
    }
  }, [picker, pickerTab]);

  const loadDirectory = useCallback(async () => {
    try {
      const result = await api.get<typeof directory>("/chat/directory");
      setDirectory(result);
      setError("");
    } catch (error) {
      setError(errorMessage(error));
    }
  }, []);
  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);
  const select = useCallback(
    (id: string, mentions = false) => {
      setPicker(false);
      setMembersOpen(false);
      router.replace(chatHref(id, admin, mentions));
    },
    [router, admin],
  );
  async function start(kind: "person" | "project", id: string) {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(true);
    setError("");
    try {
      const result =
        kind === "person"
          ? await api.post<{ conversationId: string }>("/chat/direct", {
              userId: id,
            })
          : await api.post<{ conversationId: string }>(`/chat/projects/${id}`);
      refresh();
      select(result.conversationId);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      startLock.current = false;
      setStarting(false);
    }
  }
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setError("");
    setLoading(true);
    api
      .post<{ conversationId: string }>(
        `/chat/projects/${encodeURIComponent(projectId)}`,
      )
      .then((result) => {
        if (!cancelled) {
          refresh();
          select(result.conversationId);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, select, refresh]);

  const draftKey = `hrm_chat_draft:${scope}:${conversationId}`;
  const saveDraft = (text: string, mentions = mentionedIds) => {
    setBody(text);
    setMentionedIds(mentions);
    if (!scope || !conversationId) return;
    try {
      if (text)
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            body: text,
            mentionedIds: mentions,
            reply,
            requestKey: requestKey.current,
          }),
        );
      else localStorage.removeItem(draftKey);
    } catch {}
  };
  useEffect(() => {
    setBody("");
    setMentionedIds([]);
    setReply(null);
    setSendError("");
    setMentionQuery(null);
    requestKey.current = null;
    if (!scope || !conversationId) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (draft && typeof draft.body === "string") {
        setBody(draft.body.slice(0, 5000));
        if (
          draft.reply &&
          typeof draft.reply.id === "string" &&
          typeof draft.reply.body === "string" &&
          typeof draft.reply.senderName === "string"
        )
          setReply(draft.reply);
        if (
          draft.requestKey &&
          typeof draft.requestKey.signature === "string" &&
          typeof draft.requestKey.key === "string" &&
          /^[a-f0-9-]{36}$/i.test(draft.requestKey.key)
        )
          requestKey.current = draft.requestKey;
        setMentionedIds(
          Array.isArray(draft.mentionedIds)
            ? draft.mentionedIds.filter((id: unknown) => typeof id === "string")
            : [],
        );
      }
    } catch {}
  }, [draftKey, scope, conversationId]);

  useEffect(() => {
    let cancelled = false,
      busy = false,
      firstLoad = true;
    exhaustedHistory.current = false;
    setLoadingOlder(false);
    readIds.current = new Set();
    stickToBottom.current = true;
    setDetail(null);
    setMessages([]);
    setError("");
    setHasMore(false);
    setNewBelow(false);
    if (!conversationId) {
      refreshMessages.current = () => {};
      return;
    }
    setLoading(true);
    const load = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const [room, result] = await Promise.all([
          api.get<{ conversation: ChatConversation; people: ChatPerson[] }>(
            `/chat/conversations/${conversationId}`,
          ),
          api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
            `/chat/conversations/${conversationId}/messages${mentionView ? "?mentions=1" : ""}`,
          ),
        ]);
        if (cancelled) return;
        const cached = messageCache.current,
          lastKnown = cached[cached.length - 1];
        if (
          lastKnown?.conversationId === conversationId &&
          result.hasMore &&
          !result.messages.some((message) => message.id === lastKnown.id)
        ) {
          let cursor = lastKnown.id,
            more = true;
          while (more && !cancelled) {
            const forward = await api.get<{
              messages: ChatMessage[];
              hasMore: boolean;
            }>(
              `/chat/conversations/${conversationId}/messages?after=${cursor}&size=100${mentionView ? "&mentions=1" : ""}`,
            );
            result.messages.push(...forward.messages);
            more = forward.hasMore && forward.messages.length > 0;
            if (forward.messages.length)
              cursor = forward.messages[forward.messages.length - 1].id;
          }
          if (cancelled) return;
        }
        setDetail(room);
        setError("");
        setMessages((previous) => {
          const ids = new Set(previous.map((message) => message.id));
          if (
            previous.length &&
            result.messages.some((message) => !ids.has(message.id)) &&
            !stickToBottom.current
          )
            setNewBelow(true);
          const merged = new Map(
            previous.map((message) => [message.id, message]),
          );
          result.messages.forEach((message) => merged.set(message.id, message));
          return [...merged.values()].sort(
            (a, b) =>
              a.createdAt.localeCompare(b.createdAt) ||
              a.id.localeCompare(b.id),
          );
        });
        if (firstLoad) {
          firstLoad = false;
          exhaustedHistory.current = !result.hasMore;
          setHasMore(result.hasMore);
        } else if (!exhaustedHistory.current) setHasMore(result.hasMore);
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error));
          if (
            error instanceof ApiError &&
            [401, 403, 404].includes(error.status)
          ) {
            setMessages([]);
            setDetail(null);
          }
        }
      } finally {
        busy = false;
        if (!cancelled) setLoading(false);
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    refreshMessages.current = visible;
    void load();
    const timer = setInterval(visible, 3000);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      refreshMessages.current = () => {};
    };
  }, [conversationId, mentionView]);

  useEffect(() => {
    if (stickToBottom.current && list.current) {
      list.current.scrollTop = list.current.scrollHeight;
      setNewBelow(false);
    }
  }, [messages]);
  useEffect(() => {
    const root = list.current;
    if (!root || !conversationId || !messages.length || !userId) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();
    const flush = async () => {
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      )
        return;
      const ids = [...pending]
        .filter((id) => !readIds.current.has(id))
        .slice(0, 100);
      pending.clear();
      if (!ids.length) return;
      try {
        await api.patch(`/chat/conversations/${conversationId}/read`, {
          messageIds: ids,
        });
        if (!cancelled) {
          ids.forEach((id) => readIds.current.add(id));
          refresh();
        }
      } catch {}
    };
    const scan = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus())
        return;
      const box = root.getBoundingClientRect();
      root
        .querySelectorAll<HTMLElement>("[data-chat-message]")
        .forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (
            rect.bottom > box.top &&
            rect.top < box.bottom &&
            element.dataset.sender !== userId
          ) {
            const id = element.dataset.chatMessage!;
            if (!readIds.current.has(id)) pending.add(id);
          }
        });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 250);
    };
    scan();
    root.addEventListener("scroll", scan, { passive: true });
    window.addEventListener("focus", scan);
    document.addEventListener("visibilitychange", scan);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      root.removeEventListener("scroll", scan);
      window.removeEventListener("focus", scan);
      document.removeEventListener("visibilitychange", scan);
    };
  }, [messages, conversationId, userId, refresh]);

  async function older() {
    if (loadingOlder || !messages.length) return;
    const roomId = conversationId,
      view = activeView.current,
      beforeHeight = list.current?.scrollHeight || 0;
    setLoadingOlder(true);
    try {
      const result = await api.get<{
        messages: ChatMessage[];
        hasMore: boolean;
      }>(
        `/chat/conversations/${roomId}/messages?before=${messages[0].id}${mentionView ? "&mentions=1" : ""}`,
      );
      if (activeView.current !== view) return;
      stickToBottom.current = false;
      exhaustedHistory.current = !result.hasMore;
      setMessages((previous) => [
        ...new Map(
          [...result.messages, ...previous].map((message) => [
            message.id,
            message,
          ]),
        ).values(),
      ]);
      setHasMore(result.hasMore);
      requestAnimationFrame(() => {
        if (list.current)
          list.current.scrollTop += list.current.scrollHeight - beforeHeight;
      });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoadingOlder(false);
    }
  }
  async function markAll() {
    try {
      await api.patch(`/chat/conversations/${conversationId}/read-all`);
      refresh();
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  const choices = (detail?.people || [])
    .filter(
      (person) =>
        person.userId !== userId &&
        (!mentionQuery?.query ||
          person.name.toLowerCase().includes(mentionQuery.query.toLowerCase())),
    )
    .slice(0, 7);
  function chooseMention(person: ChatPerson) {
    const cursor = composer.current?.selectionStart ?? body.length,
      start = mentionQuery?.start ?? cursor,
      end = mentionQuery?.end ?? cursor;
    const text = body.slice(0, start) + `@${person.name} ` + body.slice(end),
      ids = [...new Set([...mentionedIds, person.userId])];
    saveDraft(text, ids);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      composer.current?.focus();
      composer.current?.setSelectionRange(
        start + person.name.length + 2,
        start + person.name.length + 2,
      );
    });
  }
  function edit(text: string, cursor: number) {
    saveDraft(text);
    setMentionIndex(0);
    const match = text.slice(0, cursor).match(/(?:^|\s)@([^\s@]{0,40})$/);
    setMentionQuery(
      match
        ? { start: cursor - match[1].length - 1, end: cursor, query: match[1] }
        : null,
    );
  }
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (
      !body.trim() ||
      !detail ||
      detail.conversation.isReadOnly ||
      sendLock.current
    )
      return;
    const roomId = conversationId,
      draftStorageKey = draftKey;
    const mentions = mentionedIds.filter((id) =>
      detail.people.some(
        (person) => person.userId === id && body.includes(`@${person.name}`),
      ),
    );
    const payload = {
        body: body.trim(),
        mentionedUserIds: mentions,
        ...(reply && { replyToMessageId: reply.id }),
      },
      signature = JSON.stringify(payload);
    if (requestKey.current?.signature !== signature)
      requestKey.current = { signature, key: crypto.randomUUID() };
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          body,
          mentionedIds: mentions,
          reply,
          requestKey: requestKey.current,
        }),
      );
    } catch {}
    sendLock.current = true;
    setSending(true);
    setSendError("");
    try {
      const result = await api.post<{ message: ChatMessage }>(
        `/chat/conversations/${roomId}/messages`,
        { ...payload, clientMessageId: requestKey.current!.key },
      );
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {}
      if (activeRoom.current !== roomId) return;
      requestKey.current = null;
      setBody("");
      setMentionedIds([]);
      setReply(null);
      setMentionQuery(null);
      stickToBottom.current = true;
      if (mentionView) select(roomId);
      else
        setMessages((previous) =>
          [
            ...new Map(
              [...previous, result.message].map((message) => [
                message.id,
                message,
              ]),
            ).values(),
          ].sort(
            (a, b) =>
              a.createdAt.localeCompare(b.createdAt) ||
              a.id.localeCompare(b.id),
          ),
        );
      refresh();
      refreshMessages.current();
      composer.current?.focus();
    } catch (error) {
      if (activeRoom.current === roomId) setSendError(errorMessage(error));
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }
  const rows = (inbox?.conversations || []).filter(
    (row) =>
      (!search ||
        `${row.title} ${row.lastMessage || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter !== "unread" || !!row.unreadCount) &&
      (filter !== "mentions" || !!row.mentionCount),
  );
  const pickerRows =
    pickerTab === "people"
      ? filterChatPeople(directory.people, directorySearch)
      : directory.projects.filter((project) =>
          `${project.name} ${project.key}`
            .toLowerCase()
            .includes(directorySearch.toLowerCase()),
        );
  return (
    <>
      <div
        className={`chat-workspace ${conversationId ? "chat-room-selected" : ""}`}
      >
        <aside className="chat-sidebar">
          <header>
            <div>
              <h1>Messages</h1>
              <span>{inbox?.unreadConversations || 0} unread chats</span>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="New conversation"
              onClick={() => {
                setPicker(true);
                void loadDirectory();
              }}
            >
              <Plus size={20} />
            </button>
          </header>
          <label className="chat-search">
            <Search size={17} />
            <input
              aria-label="Search conversations or company employees"
              placeholder="Search chats or employees"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="chat-sidebar-filters">
            {["all", "unread", "mentions"].map((value) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {value === "mentions"
                  ? `@ Mentions${inbox?.mentionCount ? ` (${inbox.mentionCount})` : ""}`
                  : value === "unread"
                    ? "Unread"
                    : "All"}
              </button>
            ))}
          </div>
          {inboxError && <p className="chat-inline-error">{inboxError}</p>}
          <nav className="chat-conversations" aria-label="Conversations">
            {!!search.trim() && (
              <div className="chat-employee-results">
                <strong>Employees in this company</strong>
                {filterChatPeople(directory.people, search).map((person) => (
                  <button
                    key={person.userId}
                    type="button"
                    disabled={starting}
                    onClick={() => void start("person", person.userId)}
                  >
                    <Avatar
                      className="chat-avatar"
                      userId={person.userId}
                      version={person.photoVersion}
                      name={person.name}
                    />
                    <span>
                      <b>{person.name}</b>
                      <small>
                        {[person.employeeCode, person.jobTitle]
                          .filter(Boolean)
                          .join(" · ") || "Company member"}
                      </small>
                    </span>
                    <MessageSquare size={16} />
                  </button>
                ))}
                {!filterChatPeople(directory.people, search).length && (
                  <p>No matching employees in this company.</p>
                )}
              </div>
            )}
            {rows.map((row) => (
              <Link
                key={row.id}
                href={chatHref(row.id, admin)}
                className={`chat-conversation ${row.id === conversationId ? "active" : ""} ${row.unreadCount ? "unread" : ""}`}
              >
                <span className="chat-avatar">
                  {row.kind === "project" ? (
                    <Hash size={20} />
                  ) : (
                    <Avatar
                      className="chat-avatar"
                      userId={row.otherUserId}
                      version={row.photoVersion}
                      name={row.title}
                    />
                  )}
                </span>
                <span className="chat-conversation-copy">
                  <span>
                    <strong>{row.title}</strong>
                    {row.lastMessageAt && (
                      <time>{chatTime(row.lastMessageAt)}</time>
                    )}
                  </span>
                  <small>
                    {row.lastMessage ||
                      (row.kind === "project"
                        ? "Project group · say hello"
                        : "Start your conversation")}
                  </small>
                </span>
                <span className="chat-conversation-badges">
                  {!!row.mentionCount && (
                    <b className="chat-mention-badge">@{row.mentionCount}</b>
                  )}
                  {!!row.unreadCount && (
                    <b className="chat-count">{row.unreadCount}</b>
                  )}
                </span>
              </Link>
            ))}
            {!rows.length && (
              <div className="chat-list-empty">
                {inboxError
                  ? "Conversations could not be loaded."
                  : inbox
                    ? filter === "all"
                      ? "No conversations yet."
                      : "You’re all caught up."
                    : "Loading conversations…"}
                <button type="button" onClick={() => setPicker(true)}>
                  Start a conversation
                </button>
                {inboxError && (
                  <button
                    type="button"
                    onClick={() => {
                      refresh();
                      void loadDirectory();
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </nav>
          <button
            className="chat-sidebar-new"
            type="button"
            onClick={() => {
              setPickerTab("projects");
              setPicker(true);
              void loadDirectory();
            }}
          >
            <Hash size={17} />
            Browse project groups
          </button>
        </aside>
        <section className="chat-room" aria-label="Conversation">
          {error && (
            <p className="chat-inline-error" role="alert">
              {error}
            </p>
          )}
          {!conversationId && (
            <div className="chat-welcome">
              <span>
                <MessageSquare size={36} />
              </span>
              <h2>Your team, one conversation away</h2>
              <p>
                Message a colleague privately or keep project discussions
                together in a group.
              </p>
              <button
                className="button button-primary"
                type="button"
                onClick={() => setPicker(true)}
              >
                <Plus size={17} />
                New conversation
              </button>
            </div>
          )}
          {loading && conversationId && (
            <div className="chat-welcome">
              <Loader2 className="chat-spinner" size={28} />
              <p>Loading conversation…</p>
            </div>
          )}
          {detail && (
            <>
              <header className="chat-room-header">
                <Link
                  className="icon-button chat-mobile-back"
                  href={chatHref(undefined, admin)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={20} />
                </Link>
                <span className="chat-avatar">
                  {detail.conversation.kind === "project" ? (
                    <Hash size={22} />
                  ) : (
                    <Avatar
                      className="chat-avatar"
                      userId={detail.conversation.otherUserId}
                      version={detail.conversation.photoVersion}
                      name={detail.conversation.title}
                    />
                  )}
                </span>
                <div className="chat-room-title">
                  <h2>{detail.conversation.title}</h2>
                  <span>
                    {detail.conversation.kind === "project"
                      ? `${detail.conversation.projectKey} · ${detail.people.length} members`
                      : "Direct message"}
                    {detail.conversation.isReadOnly ? " · Read-only" : ""}
                  </span>
                </div>
                <div className="chat-room-actions">
                  <button
                    type="button"
                    className={mentionView ? "active" : ""}
                    aria-label="Show mentions"
                    title="Show mentions"
                    onClick={() => select(conversationId, !mentionView)}
                  >
                    <AtSign size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void markAll()}
                    aria-label="Mark conversation as read"
                    title="Mark all read"
                  >
                    <CheckCheck size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMembersOpen((value) => !value)}
                    aria-label="Conversation members"
                    title="Members"
                  >
                    <Users size={18} />
                  </button>
                </div>
              </header>
              {mentionView && (
                <div className="chat-mentions-banner">
                  <AtSign size={16} />
                  Mentions of you in this conversation
                  <button type="button" onClick={() => select(conversationId)}>
                    Show all messages
                  </button>
                </div>
              )}
              <div className="chat-message-stage">
                <div
                  className="chat-message-list"
                  ref={list}
                  onScroll={() => {
                    const node = list.current;
                    if (node) {
                      stickToBottom.current =
                        node.scrollHeight - node.scrollTop - node.clientHeight <
                        90;
                      if (stickToBottom.current) setNewBelow(false);
                    }
                  }}
                  aria-label="Messages"
                  aria-live="polite"
                  aria-relevant="additions"
                >
                  {hasMore && (
                    <button
                      className="chat-load-older"
                      disabled={loadingOlder}
                      type="button"
                      onClick={() => void older()}
                    >
                      {loadingOlder ? "Loading…" : "Load earlier messages"}
                    </button>
                  )}
                  {!messages.length && (
                    <div className="chat-message-empty">
                      {mentionView
                        ? "No mentions of you yet."
                        : "This is the start of the conversation. Say hello 👋"}
                    </div>
                  )}
                  {messages.map((message, index) => (
                    <Fragment key={message.id}>
                      {(!index ||
                        chatDay(messages[index - 1].createdAt) !==
                          chatDay(message.createdAt)) && (
                        <div className="chat-day-divider">
                          <span>{chatDay(message.createdAt)}</span>
                        </div>
                      )}
                      <article
                        data-chat-message={message.id}
                        data-sender={message.senderUserId}
                        className={`chat-message ${message.senderUserId === userId ? "own" : ""}`}
                      >
                        <div className="chat-message-content">
                          <strong className="chat-message-author">
                            {message.senderUserId === userId
                              ? "You"
                              : message.senderName}
                          </strong>
                          {message.replyTo && (
                            <blockquote>
                              <strong>{message.replyTo.authorName}</strong>
                              <span>{message.replyTo.body}</span>
                            </blockquote>
                          )}
                          <div className="chat-message-body">
                            <MessageBody message={message} />
                          </div>
                          <footer>
                            <time dateTime={message.createdAt}>
                              {chatTime(message.createdAt)}
                            </time>
                            {message.senderUserId === userId &&
                              (message.readCount > 0 ? (
                                <CheckCheck
                                  size={14}
                                  className="chat-seen"
                                  aria-label="Read"
                                />
                              ) : (
                                <Check size={14} aria-label="Sent" />
                              ))}
                            <button
                              type="button"
                              aria-label={`Reply to ${message.senderName}`}
                              title="Reply"
                              onClick={() => {
                                setReply(message);
                                composer.current?.focus();
                              }}
                            >
                              <Reply size={15} />
                            </button>
                          </footer>
                        </div>
                      </article>
                    </Fragment>
                  ))}
                </div>
                {newBelow && (
                  <button
                    className="chat-new-below"
                    type="button"
                    onClick={() => {
                      if (list.current)
                        list.current.scrollTop = list.current.scrollHeight;
                      stickToBottom.current = true;
                      setNewBelow(false);
                    }}
                  >
                    <ArrowDown size={15} />
                    New messages
                  </button>
                )}
              </div>
              {detail.conversation.isReadOnly ? (
                <p className="chat-readonly">
                  {detail.conversation.kind === "project"
                    ? "This project is archived. Its conversation history remains available."
                    : "This person is no longer an active member of this company."}
                </p>
              ) : (
                <form
                  className="chat-composer"
                  onSubmit={(event) => void send(event)}
                >
                  {reply && (
                    <div className="chat-reply-preview">
                      <Reply size={16} />
                      <span>
                        <strong>Replying to {reply.senderName}</strong>
                        <small>{reply.body}</small>
                      </span>
                      <button
                        type="button"
                        onClick={() => setReply(null)}
                        aria-label="Cancel reply"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {sendError && (
                    <p className="chat-inline-error" role="alert">
                      {sendError} Your draft is saved. Send again to retry.
                    </p>
                  )}
                  <div className="chat-compose-input">
                    <textarea
                      ref={composer}
                      aria-label="Message"
                      placeholder={
                        detail.conversation.kind === "project"
                          ? "Write a message · @ to mention someone"
                          : "Write a message"
                      }
                      rows={2}
                      maxLength={5000}
                      disabled={sending}
                      value={body}
                      onChange={(event) =>
                        edit(event.target.value, event.target.selectionStart)
                      }
                      onKeyDown={(event) => {
                        if (mentionQuery && choices.length) {
                          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                            event.preventDefault();
                            setMentionIndex(
                              (value) =>
                                (value +
                                  (event.key === "ArrowDown"
                                    ? 1
                                    : choices.length - 1)) %
                                choices.length,
                            );
                            return;
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            chooseMention(
                              choices[mentionIndex % choices.length],
                            );
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setMentionQuery(null);
                            return;
                          }
                        }
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                    />
                    {mentionQuery && choices.length > 0 && (
                      <div
                        className="chat-mention-picker"
                        role="listbox"
                        aria-label="Mention a member"
                      >
                        {choices.map((person, index) => (
                          <button
                            key={person.userId}
                            type="button"
                            role="option"
                            aria-selected={index === mentionIndex}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => chooseMention(person)}
                          >
                            <Avatar
                              className="chat-avatar"
                              userId={person.userId}
                              version={person.photoVersion}
                              name={person.name}
                            />
                            <span>
                              <strong>{person.name}</strong>
                              <small>
                                {person.employeeCode ||
                                  person.jobTitle ||
                                  "Company member"}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="chat-composer-footer">
                    <span>
                      <button
                        type="button"
                        aria-label="Mention someone"
                        title="Mention someone"
                        onClick={() => {
                          const cursor =
                            composer.current?.selectionStart ?? body.length;
                          const text =
                            body.slice(0, cursor) + "@" + body.slice(cursor);
                          saveDraft(text);
                          setMentionQuery({
                            start: cursor,
                            end: cursor + 1,
                            query: "",
                          });
                          setMentionIndex(0);
                          composer.current?.focus();
                        }}
                      >
                        <AtSign size={19} />
                      </button>
                      <small>
                        Enter to send · Shift + Enter for a new line
                      </small>
                    </span>
                    <button
                      className="button button-primary"
                      disabled={sending || !body.trim()}
                    >
                      <Send size={17} />
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
        {membersOpen && detail && (
          <aside className="chat-members">
            <header>
              <h3>Members</h3>
              <button
                type="button"
                onClick={() => setMembersOpen(false)}
                aria-label="Close members"
              >
                <X size={18} />
              </button>
            </header>
            {detail.people.map((person) => (
              <div key={person.userId}>
                <Avatar
                  className="chat-avatar"
                  userId={person.userId}
                  version={person.photoVersion}
                  name={person.name}
                />
                <span>
                  <strong>
                    {person.name}
                    {person.userId === userId ? " (you)" : ""}
                  </strong>
                  <small>
                    {person.jobTitle || person.employeeCode || "Company member"}
                  </small>
                </span>
              </div>
            ))}
            {detail.conversation.projectId && (
              <Link
                href={`${prefix}/projects/${detail.conversation.projectId}/board`}
              >
                Open project
                <ArrowLeft size={15} style={{ transform: "rotate(180deg)" }} />
              </Link>
            )}
          </aside>
        )}
      </div>
      {picker && (
        <div
          className="chat-picker-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPicker(false);
          }}
        >
          <div
            className="chat-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-picker-heading"
            ref={dialog}
            onKeyDown={(event) => {
              if (event.key === "Escape") setPicker(false);
              if (event.key === "Tab") {
                const nodes = dialog.current?.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input,a[href]",
                );
                if (!nodes?.length) return;
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <header>
              <div>
                <h2 id="chat-picker-heading">New conversation</h2>
                <p>Choose a person or a project group.</p>
              </div>
              <button
                type="button"
                aria-label="Close new conversation"
                onClick={() => setPicker(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="chat-picker-tabs">
              <button
                className={pickerTab === "people" ? "active" : ""}
                onClick={() => setPickerTab("people")}
              >
                <MessageSquare size={16} />
                Direct message
              </button>
              <button
                className={pickerTab === "projects" ? "active" : ""}
                onClick={() => setPickerTab("projects")}
              >
                <Hash size={16} />
                Project group
              </button>
            </div>
            <label className="chat-search">
              <Search size={17} />
              <input
                ref={directoryInput}
                aria-label="Find a person or project"
                placeholder={
                  pickerTab === "people"
                    ? "Search employees in this company"
                    : "Search projects"
                }
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
              />
            </label>
            {error && <p className="chat-inline-error">{error}</p>}
            <div className="chat-picker-results">
              {pickerRows.map((row) =>
                "userId" in row ? (
                  <button
                    key={row.userId}
                    type="button"
                    disabled={starting}
                    onClick={() => void start("person", row.userId)}
                  >
                    <Avatar
                      className="chat-avatar"
                      userId={row.userId}
                      version={row.photoVersion}
                      name={row.name}
                    />
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {row.jobTitle || row.employeeCode || "Company member"}
                      </small>
                    </span>
                    <Plus size={17} />
                  </button>
                ) : (
                  <button
                    key={row.id}
                    type="button"
                    disabled={starting}
                    onClick={() => void start("project", row.id)}
                  >
                    <span className="chat-avatar">
                      <Hash size={20} />
                    </span>
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {row.key}
                        {row.status === "archived"
                          ? " · Archived"
                          : " · Project group"}
                      </small>
                    </span>
                    <Plus size={17} />
                  </button>
                ),
              )}
              {!pickerRows.length && (
                <p className="chat-list-empty">
                  No {pickerTab === "people" ? "people" : "projects"} found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default function ChatPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-line" />}>
        <ChatCompanyGate>
          <ChatWorkspace />
        </ChatCompanyGate>
      </Suspense>
    </AppShell>
  );
}

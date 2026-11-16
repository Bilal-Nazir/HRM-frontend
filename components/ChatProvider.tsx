"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ChatInbox } from "@/lib/chat";

const ChatContext = createContext<{
  inbox: ChatInbox | null;
  error: string;
  refresh: () => void;
}>({ inbox: null, error: "", refresh: () => {} });
export const useChatInbox = () => useContext(ChatContext);
export default function ChatProvider({
  scope,
  children,
}: {
  scope: string;
  children: ReactNode;
}) {
  const [inbox, setInbox] = useState<ChatInbox | null>(null),
    [error, setError] = useState("");
  const reload = useRef<() => void>(() => {});
  const refresh = useCallback(() => reload.current(), []);
  useEffect(() => {
    let cancelled = false,
      busy = false,
      requested = false;
    setInbox(null);
    setError("");
    if (!scope) {
      reload.current = () => {};
      return;
    }
    const matches = () => {
      const user = getSession();
      return !!user && `${user.organizationId}:${user.userId}` === scope;
    };
    const load = async () => {
      if (cancelled || !matches()) {
        if (!cancelled) setInbox(null);
        return;
      }
      if (busy) {
        requested = true;
        return;
      }
      busy = true;
      try {
        const data = await api.get<ChatInbox>("/chat/inbox");
        if (!cancelled && matches()) {
          setInbox(data);
          setError("");
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Chat is temporarily unavailable",
          );
          if (error instanceof ApiError && [401, 403].includes(error.status))
            setInbox(null);
        }
      } finally {
        busy = false;
        if (requested && !cancelled) {
          requested = false;
          void load();
        }
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    reload.current = visible;
    void load();
    const timer = setInterval(visible, 3000);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      reload.current = () => {};
    };
  }, [scope]);
  return (
    <ChatContext.Provider value={{ inbox, error, refresh }}>
      {children}
    </ChatContext.Provider>
  );
}

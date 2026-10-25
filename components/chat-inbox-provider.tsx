"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { releaseChatChannel } from "@/lib/chat/channel-cleanup";
import { usePathname } from "next/navigation";
import { loadInbox } from "@/app/messages/actions";
import type { InboxSnapshot } from "@/lib/chat/inbox";
const Context = createContext<{
  snapshot: InboxSnapshot;
  error: string;
  refresh: () => void;
  goToPage: (page: number) => void;
  loading: boolean;
}>({
  snapshot: { chats: [], unread: {} },
  error: "",
  refresh: () => {},
  goToPage: () => {},
  loading: false,
});
export const useChatInbox = () => useContext(Context);
export function ChatInboxProvider({
  children,
  userId,
  initial,
  initialError = "",
}: {
  children: React.ReactNode;
  userId: string;
  initial: InboxSnapshot;
  initialError?: string;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState(initialError);
  const pageRef = useRef(initial.page ?? 1);
  const [loading, setLoading] = useState(false);
  const goToPage = useCallback((page: number) => {
    pageRef.current = page;
    setRevision((v) => v + 1);
  }, []);
  const [revision, setRevision] = useState(0);
  const pathname = usePathname();
  const syncRef = useRef<() => void>();
  useEffect(() => {
    syncRef.current?.();
  }, [revision, pathname]);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!userId) return;
    let active = true,
      busy = false,
      queued = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let client:
      | ReturnType<typeof import("@/lib/supabase/client").createClient>
      | undefined;
    let channel: ReturnType<NonNullable<typeof client>["channel"]> | undefined;
    async function sync() {
      if (!active || document.visibilityState !== "visible") return;
      if (busy) {
        queued = true;
        return;
      }
      busy = true;
      setLoading(true);
      try {
        const result = await loadInbox(pageRef.current);
        if (!active) return;
        if (result.snapshot) {
          setSnapshot(result.snapshot);
          setError("");
        } else setError(result.error || "Unable to refresh conversations.");
      } catch {
        if (active) setError("Unable to refresh conversations. Please retry.");
      } finally {
        busy = false;
        if (active) setLoading(false);
        if (queued && active) {
          queued = false;
          schedule();
        }
      }
    }
    function schedule() {
      if (!active) return;
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), 100);
    }
    syncRef.current = schedule;
    // Realtime applies messages SELECT RLS, so only the user's accepted chats
    // deliver events. Refresh authoritative counts for INSERT and read UPDATE.
    void import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (!active) return;
        client = createClient();
        channel = client
          .channel(`inbox:${userId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            schedule,
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "messages" },
            schedule,
          )
          .subscribe((status) => {
            if (!active) return;
            if (status === "SUBSCRIBED") schedule();
            if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status))
              setError(
                "Live updates interrupted. Counts will refresh when reconnected.",
              );
          });
      })
      .catch(() => {
        if (active) setError("Live updates unavailable. Please retry.");
      });
    schedule();
    const interval = setInterval(schedule, 60000);
    window.addEventListener("online", schedule);
    window.addEventListener("chat-read", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", schedule);
      window.removeEventListener("chat-read", schedule);
      document.removeEventListener("visibilitychange", schedule);
      if (client && channel) void releaseChatChannel(client, channel);
    };
  }, [userId]);
  return (
    <Context.Provider value={{ snapshot, error, refresh, goToPage, loading }}>
      {children}
    </Context.Provider>
  );
}

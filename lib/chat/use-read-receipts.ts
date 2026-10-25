"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { markChatRead } from "@/app/chat/actions";
import type { LocalMessage } from "@/lib/chat/types";

export function useReadReceipts(
  requestId: string,
  userId: string,
  messages: LocalMessage[],
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>,
) {
  const latest = useRef(messages);
  latest.current = messages;
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  // Trigger only for newly confirmed unread messages, not every render.
  const unreadIds = messages
    .filter((m) => !m.delivery && m.sender_id !== userId && !m.read_at)
    .map((m) => m.id)
    .join(",");
  const ownIds = messages
    .filter((m) => !m.delivery && m.sender_id === userId && !m.read_at)
    .map((m) => m.id)
    .join(",");
  useEffect(() => {
    let active = true,
      busy = false;
    async function sync() {
      if (!active || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        // Batch all unread messages in this open chat, including older history.
        const result = await markChatRead(requestId);
        if (!active) return;
        if (result.error) setError(result.error);
        else if (result.readAt) {
          const readAt = result.readAt;
          setError("");
          setMessages((rows) =>
            rows.map((row) =>
              !row.delivery &&
              row.sender_id !== userId &&
              !row.read_at &&
              Date.parse(row.created_at) <= Date.parse(readAt)
                ? { ...row, read_at: readAt }
                : row,
            ),
          );
          window.dispatchEvent(new Event("chat-read"));
        }
        // Reconcile receipts missed while disconnected or while the tab was hidden.
        const ids = latest.current
          .filter((m) => !m.delivery && m.sender_id === userId && !m.read_at)
          .map((m) => m.id);
        if (!ids.length) return;
        const { createClient } = await import("@/lib/supabase/client");
        if (!active) return;
        const client = createClient();
        for (let i = 0; active && i < ids.length; i += 100) {
          const { data, error: fetchError } = await client
            .from("messages")
            .select("id, read_at")
            .eq("request_id", requestId)
            .eq("sender_id", userId)
            .in("id", ids.slice(i, i + 100))
            .limit(100);
          if (!active) return;
          if (fetchError) {
            setError("Read receipts could not refresh. Please retry.");
            break;
          }
          const receipts = new Map(
            (data ?? [])
              .filter((row) => row.read_at)
              .map((row) => [row.id, row.read_at as string]),
          );
          if (receipts.size)
            setMessages((rows) =>
              rows.map((row) =>
                receipts.has(row.id)
                  ? { ...row, read_at: receipts.get(row.id) }
                  : row,
              ),
            );
        }
      } catch {
        if (active) setError("Read receipts could not refresh. Please retry.");
      } finally {
        busy = false;
      }
    }
    const timer = setTimeout(() => void sync(), 100);
    const interval = setInterval(() => void sync(), 30000);
    const onVisible = () => void sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [requestId, userId, unreadIds, ownIds, retry, setMessages]);
  return { error, retry: () => setRetry((v) => v + 1) };
}

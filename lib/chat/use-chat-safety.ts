"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadChatSafety } from "@/app/chat/safety-actions";
import type { ChatSendState } from "@/lib/chat/safety";
export function useChatSafety(requestId: string, initial: ChatSendState) {
  const localBlock = useRef(false);
  const [state, setState] = useState(initial);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true,
      busy = false;
    async function sync() {
      if (!active || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const result = await loadChatSafety(requestId);
        if (active) {
          setState(localBlock.current ? "blocked" : result.state);
          setError(result.error || "");
        }
      } catch {
        if (active) {
          setState("unavailable");
          setError("Unable to check chat availability. Please retry.");
        }
      } finally {
        busy = false;
      }
    }
    void sync();
    const timer = setInterval(() => void sync(), 10000);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("chat-safety-changed", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("chat-safety-changed", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [requestId, revision]);
  return {
    state,
    error,
    refresh,
    block: () => {
      localBlock.current = true;
      setState("blocked");
    },
  };
}

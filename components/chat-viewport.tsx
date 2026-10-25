"use client";
import { useEffect, useRef } from "react";
import { bindChatViewport } from "@/lib/chat/viewport";
export function ChatViewport({ children }: { children: React.ReactNode }) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!element.current || !window.visualViewport) return;
    return bindChatViewport(element.current, window.visualViewport);
  }, []);
  return (
    <section
      ref={element}
      className="fixed inset-x-0 top-0 z-30 mx-auto flex h-dvh min-w-0 max-w-5xl flex-col overflow-hidden chat-surface bg-paper font-ui text-ink"
    >
      {children}
    </section>
  );
}

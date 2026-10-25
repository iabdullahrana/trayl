"use client";
import { useLayoutEffect, useState } from "react";
export function ChatSafetyBanner({
  requestId,
  userId,
}: {
  requestId: string;
  userId: string;
}) {
  const key = `chat-safety-v1:${userId}:${requestId}`;
  const [visible, setVisible] = useState(true);
  useLayoutEffect(() => {
    try {
      setVisible(localStorage.getItem(key) !== "dismissed");
    } catch {
      setVisible(true);
    }
  }, [key]);
  if (!visible) return null;
  return (
    <aside
      aria-label="Chat safety reminder"
      className="flex max-h-[25%] min-h-11 shrink items-start overflow-y-auto gap-2 border-b border-sage/30 bg-deep/5 px-4 py-3 text-sm text-deep"
    >
      <p className="flex-1">
        Never share OTPs or payment details. Meet in public places. Don&apos;t
        carry illegal or prohibited items.
      </p>
      <button
        type="button"
        className="min-h-11 shrink-0 px-2 font-semibold underline"
        onClick={() => {
          try {
            localStorage.setItem(key, "dismissed");
          } catch {
            /* Keep the warning usable when browser storage is disabled. */
          }
          setVisible(false);
        }}
      >
        Got it
      </button>
    </aside>
  );
}

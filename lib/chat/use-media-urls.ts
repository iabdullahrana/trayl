"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { LocalMessage } from "@/lib/chat/types";
import { refreshSignedMedia, type SignedMedia } from "@/lib/chat/signed-media";
export type { SignedMedia } from "@/lib/chat/signed-media";
export function useMediaUrls(
  messages: LocalMessage[],
  root: RefObject<HTMLDivElement>,
) {
  // Per mounted thread: credentials/URLs never enter localStorage or the DB.
  const cache = useRef(new Map<string, SignedMedia>());
  const [urls, setUrls] = useState<Record<string, SignedMedia>>({});
  const [visible, setVisible] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const mediaKey = JSON.stringify(
    messages
      .filter((m) => m.media_path && !m.delivery)
      .map((m) => [m.media_path, m.media_type]),
  );
  useEffect(() => {
    const box = root.current;
    if (!box) return;
    const visibleElements = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibleElements.add(entry.target);
          else visibleElements.delete(entry.target);
        }
        const next = [
          ...new Set(
            [...visibleElements]
              .map((element) => element.getAttribute("data-media-path")!)
              .filter(Boolean),
          ),
        ].sort();
        setVisible((current) =>
          JSON.stringify(current) === JSON.stringify(next) ? current : next,
        );
      },
      { root: box, rootMargin: "160px" },
    );
    box
      .querySelectorAll("[data-media-path]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [mediaKey, root]);
  const visibleKey = JSON.stringify(visible);
  useEffect(() => {
    let active = true;
    let busy = false;
    const types = new Map<string, string>(JSON.parse(mediaKey));
    async function refresh() {
      if (!active || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (!active) return;
        const client = createClient();
        const next = await refreshSignedMedia(
          cache.current,
          types,
          JSON.parse(visibleKey),
          client.storage.from("chat-media"),
        );
        if (active) setUrls(next);
      } catch {
        if (active)
          setUrls((current) => ({
            ...current,
            ...Object.fromEntries(
              (JSON.parse(visibleKey) as string[]).map((path) => [
                path,
                {
                  error: "Could not load private media. Please retry.",
                  expiresAt: 0,
                },
              ]),
            ),
          }));
      } finally {
        busy = false;
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const wake = () => void refresh();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [visibleKey, mediaKey, version]);
  function retry(path: string) {
    cache.current.delete(path);
    setUrls((current) => ({ ...current, [path]: { expiresAt: 0 } }));
    setVersion((value) => value + 1);
  }
  return { urls, retry };
}

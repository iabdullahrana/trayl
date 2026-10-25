"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useChatSafety } from "@/lib/chat/use-chat-safety";
import type { ChatSendState } from "@/lib/chat/safety";
import { ChatSafetyControls } from "@/components/chat-safety-controls";
import { ChatHandover } from "@/components/chat-handover";
import { ChatSafetyBanner } from "@/components/chat-safety-banner";
import { RouteStub } from "@/components/ui/RouteStub";
import Link from "next/link";
import { releaseChatChannel } from "@/lib/chat/channel-cleanup";
import { createChatActivity, type ChatActivity } from "@/lib/chat/activity";
import { sendMessage, loadMessages } from "@/app/chat/actions";
import {
  mergeMessages,
  dayLabel,
  type Message,
  type LocalMessage,
  type Cursor,
} from "@/lib/chat/types";
import { useReadReceipts } from "@/lib/chat/use-read-receipts";
import { ListSkeleton } from "@/components/ui/ListSkeleton";
import { Spinner } from "@/components/spinner";
import { ChatAttachments } from "@/components/chat-attachments";
import { ChatMedia } from "@/components/chat-media";
import { useMediaUrls } from "@/lib/chat/use-media-urls";
import { mediaKind, sanitizeFilename, type MediaInput } from "@/lib/chat/media";
import { trackUploadProgress } from "@/lib/supabase/upload-client";
import { sendMediaMessage, cleanupMediaUpload } from "@/app/chat/media-actions";
type MediaJob = {
  file: File;
  caption: string;
  path?: string;
  uploaded: boolean;
  cleanup: boolean;
  preview: string;
};

export function ChatThread({
  requestId,
  userId,
  otherId,
  otherName,
  journeyLabel,
  journeyFrom,
  journeyTo,
  initialMessages,
  initialHasMore,
  initialSendState,
}: {
  requestId: string;
  userId: string;
  otherId: string;
  otherName: string;
  journeyLabel: string;
  journeyFrom: string;
  journeyTo: string;
  initialMessages: Message[];
  initialHasMore: boolean;
  initialSendState: ChatSendState;
}) {
  const safety = useChatSafety(requestId, initialSendState);
  const canSend = safety.state === "available";
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const receipts = useReadReceipts(requestId, userId, messages, setMessages);
  const [activity, setActivity] = useState<ChatActivity>({
    online: false,
    typing: false,
  });
  const activityRef = useRef<ReturnType<typeof createChatActivity> | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [connection, setConnection] = useState("Connecting to live chat…");
  const [retryConnection, setRetryConnection] = useState(0);
  const [newMessages, setNewMessages] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const prepend = useRef<{ height: number; top: number } | null>(null);
  const historyCursor = useRef<Cursor | undefined>(initialMessages[0]);
  const syncCursor = useRef<Cursor | undefined>(initialMessages.at(-1));
  const knownIds = useRef(
    new Set(initialMessages.map((message) => message.id)),
  );
  const inflight = useRef(new Set<string>());
  const olderBusy = useRef(false);
  const mediaJobs = useRef(new Map<string, MediaJob>());
  const { urls: mediaUrls, retry: retryMediaUrl } = useMediaUrls(
    messages,
    viewport,
  );
  useEffect(
    () => () => {
      for (const job of mediaJobs.current.values())
        URL.revokeObjectURL(job.preview);
    },
    [],
  );

  const append = useCallback((rows: Message[]) => {
    if (!rows.length) return;
    const hasNew = rows.some((row) => !knownIds.current.has(row.id));
    rows.forEach((row) => {
      knownIds.current.add(row.id);
      const job = mediaJobs.current.get(row.id);
      if (job) {
        URL.revokeObjectURL(job.preview);
        mediaJobs.current.delete(row.id);
      }
    });
    setMessages((current) => mergeMessages(current, rows));
    if (hasNew && !stickToBottom.current) setNewMessages(true);
  }, []);

  useLayoutEffect(() => {
    const box = viewport.current;
    if (!box) return;
    if (prepend.current) {
      box.scrollTop =
        prepend.current.top + box.scrollHeight - prepend.current.height;
      prepend.current = null;
    } else if (stickToBottom.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) box.scrollTop = box.scrollHeight;
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  }, [draft]);

  useEffect(() => {
    let active = true;
    let syncing = false;
    let dispose = () => {};
    void import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (!active) return;
        const supabase = createClient();
        // Catch up after subscription and reconnection so the SSR/subscription gap
        // and messages missed while offline don't silently disappear.
        async function catchUp() {
          if (syncing) return;
          syncing = true;
          try {
            let cursor = syncCursor.current;
            let more = true;
            while (active && more) {
              const page = await loadMessages(
                requestId,
                cursor,
                cursor ? "after" : "before",
              );
              if (!active) return;
              if (page.error) {
                setConnection(page.error);
                return;
              }
              const rows = page.messages ?? [];
              append(rows);
              // A previously empty chat may now have more than a full page.
              if (!cursor && page.hasMore) {
                setHasMore(true);
                historyCursor.current = rows[0];
              }
              more = Boolean(cursor && page.hasMore && rows.length);
              cursor = rows.at(-1) ?? cursor;
              syncCursor.current = cursor;
            }
            if (active) setConnection("");
          } catch {
            if (active)
              setConnection("Live chat disconnected. Reconnect to catch up.");
          } finally {
            syncing = false;
          }
        }
        setActivity({ online: false, typing: false });
        const sessionId = crypto.randomUUID();
        const channel = supabase.channel(`chat:${requestId}`, {
          config: {
            private: true,
            broadcast: { self: false },
            presence: { key: sessionId },
          },
        });
        const chatActivity = createChatActivity(
          channel,
          userId,
          otherId,
          sessionId,
          setActivity,
          setActivityError,
        );
        activityRef.current = chatActivity;
        channel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `request_id=eq.${requestId}`,
            },
            (payload) => {
              const row = payload.new as Message;
              if (active && row.request_id === requestId) append([row]);
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "messages",
              filter: `request_id=eq.${requestId}`,
            },
            (payload) => {
              const row = payload.new as Message;
              if (active && row.request_id === requestId && row.read_at) {
                // Patch receipts only: an UPDATE must not insert an unloaded old message
                // or clear an optimistic delivery state.
                setMessages((current) =>
                  current.map((message) =>
                    message.id === row.id
                      ? { ...message, read_at: row.read_at }
                      : message,
                  ),
                );
              }
            },
          )
          .subscribe((status) => {
            if (!active) return;
            if (status === "SUBSCRIBED") {
              chatActivity.subscribed();
              void catchUp();
            } else if (
              ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)
            ) {
              chatActivity.disconnected();
              setConnection("Live chat disconnected. Reconnect to catch up.");
            }
          });
        const onVisible = () => {
          if (document.visibilityState === "visible") void catchUp();
          else chatActivity.stop();
        };
        const onOffline = () => {
          chatActivity.disconnected();
          setConnection("You are offline. Reconnect to catch up.");
        };
        const onOnline = () => {
          // A brief offline interval may not close the socket or emit SUBSCRIBED.
          if (channel.state === "joined") chatActivity.subscribed();
          void catchUp();
        };
        window.addEventListener("offline", onOffline);
        window.addEventListener("blur", chatActivity.stop);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisible);
        dispose = () => {
          chatActivity.dispose();
          if (activityRef.current === chatActivity) activityRef.current = null;
          window.removeEventListener("offline", onOffline);
          window.removeEventListener("blur", chatActivity.stop);
          window.removeEventListener("online", onOnline);
          document.removeEventListener("visibilitychange", onVisible);
          void releaseChatChannel(supabase, channel);
        };
      })
      .catch(() => {
        if (active)
          setConnection("Live chat disconnected. Reconnect to catch up.");
      });
    return () => {
      active = false;
      dispose();
    };
  }, [requestId, userId, otherId, append, retryConnection]);

  useEffect(() => {
    if (!canSend) activityRef.current?.stop();
  }, [canSend]);

  function patchMedia(id: string, patch: Partial<LocalMessage>) {
    setMessages((current) =>
      current.map((row) =>
        row.id === id && row.delivery ? { ...row, ...patch } : row,
      ),
    );
  }
  async function deliverMedia(id: string) {
    const job = mediaJobs.current.get(id);
    if (!canSend || !job || inflight.current.has(id)) return;
    inflight.current.add(id);
    setError("");
    try {
      if (!navigator.onLine)
        throw new Error("You're offline. Reconnect and retry this attachment.");
      if (job.cleanup && job.path) {
        const cleanup = await cleanupMediaUpload(requestId, id, job.path);
        if (cleanup.message) {
          append([cleanup.message]);
          return;
        }
        if (!cleanup.uploadRemoved)
          throw new Error(
            cleanup.error ||
              "Reconnect to finish attachment cleanup before retrying.",
          );
        job.path = undefined;
        job.uploaded = false;
        job.cleanup = false;
      }
      if (!job.path)
        job.path = `${requestId}/${crypto.randomUUID()}-${sanitizeFilename(job.file.name)}`;
      if (!job.uploaded) {
        patchMedia(id, {
          delivery: "uploading",
          uploadProgress: 0,
          media_path: job.path,
        });
        const stopTracking = trackUploadProgress(job.path, (percent) =>
          patchMedia(id, { uploadProgress: percent }),
        );
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const uploaded = await createClient()
            .storage.from("chat-media")
            .upload(job.path, job.file, {
              contentType: job.file.type,
              upsert: false,
              cacheControl: "3600",
            });
          if (uploaded.error)
            throw new Error("Upload failed. Check your connection and retry.");
        } finally {
          stopTracking();
        }
        job.uploaded = true;
      }
      patchMedia(id, { delivery: "sending", uploadProgress: 100 });
      const media: MediaInput = {
        path: job.path,
        type: mediaKind(job.file.type),
        name: job.file.name,
        size: job.file.size,
      };
      const result = await sendMediaMessage(requestId, id, job.caption, media);
      if (result.message) {
        append([result.message]);
        return;
      }
      if (result.uploadRemoved) {
        job.path = undefined;
        job.uploaded = false;
        job.cleanup = false;
      } else if (result.cleanupPending) job.cleanup = true;
      patchMedia(id, { delivery: "failed" });
      setError(result.error || "Attachment failed. Please retry.");
    } catch (error) {
      let description =
        error instanceof Error ? error.message : "Upload failed. Please retry.";
      // An interrupted upload or response might still have reached the server.
      // Cleanup claims safely reconcile it with any committed message.
      if (job.path) {
        job.cleanup = true;
        if (navigator.onLine) {
          try {
            const cleanup = await cleanupMediaUpload(requestId, id, job.path);
            if (cleanup.message) {
              append([cleanup.message]);
              return;
            }
            if (cleanup.uploadRemoved) {
              job.path = undefined;
              job.uploaded = false;
              job.cleanup = false;
            } else description = cleanup.error || description;
          } catch {
            description = "Reconnect and retry to finish attachment cleanup.";
          }
        }
      }
      patchMedia(id, { delivery: "failed" });
      setError(description);
    } finally {
      inflight.current.delete(id);
      window.dispatchEvent(new Event("chat-safety-changed"));
    }
  }
  function queueMedia(file: File, caption: string) {
    if (!canSend) return;
    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    mediaJobs.current.set(id, {
      file,
      caption,
      uploaded: false,
      cleanup: false,
      preview,
    });
    const message: LocalMessage = {
      id,
      request_id: requestId,
      sender_id: userId,
      body: caption || null,
      created_at: new Date().toISOString(),
      media_path: null,
      media_type: mediaKind(file.type),
      media_name: file.name,
      media_size: file.size,
      delivery: "uploading",
      uploadProgress: 0,
      localMediaUrl: preview,
    };
    knownIds.current.add(id);
    if (!stickToBottom.current) setNewMessages(true);
    setMessages((current) => [...current, message]);
    void deliverMedia(id);
  }

  async function deliver(message: LocalMessage) {
    if (!canSend) return;
    if (mediaJobs.current.has(message.id)) {
      await deliverMedia(message.id);
      return;
    }
    if (inflight.current.has(message.id)) return;
    inflight.current.add(message.id);
    setMessages((current) =>
      current.map((row) =>
        row.id === message.id ? { ...row, delivery: "sending" } : row,
      ),
    );
    try {
      const result = await sendMessage(
        requestId,
        message.id,
        message.body ?? "",
      );
      if (result.message) append([result.message]);
      else {
        // Realtime may already have confirmed it while the HTTP response failed.
        setMessages((current) =>
          current.map((row) =>
            row.id === message.id && row.delivery
              ? { ...row, delivery: "failed" }
              : row,
          ),
        );
        setError(result.error || "Unable to send this message.");
      }
    } catch {
      setMessages((current) =>
        current.map((row) =>
          row.id === message.id && row.delivery
            ? { ...row, delivery: "failed" }
            : row,
        ),
      );
      setError("Connection failed. Retry the message below.");
    } finally {
      inflight.current.delete(message.id);
      window.dispatchEvent(new Event("chat-safety-changed"));
    }
  }

  function submit() {
    const body = draft.trim();
    if (!canSend || !body || Array.from(body).length > 2000) return;
    const message: LocalMessage = {
      id: crypto.randomUUID(),
      request_id: requestId,
      sender_id: userId,
      body,
      created_at: new Date().toISOString(),
      media_path: null,
      delivery: "sending",
    };
    knownIds.current.add(message.id);
    activityRef.current?.stop();
    setDraft("");
    setError("");
    if (!stickToBottom.current) setNewMessages(true);
    setMessages((current) => [...current, message]);
    void deliver(message);
  }

  async function older() {
    if (olderBusy.current || !historyCursor.current) return;
    olderBusy.current = true;
    setLoadingOlder(true);
    setError("");
    try {
      const page = await loadMessages(requestId, historyCursor.current);
      if (page.error) {
        setError(page.error);
        return;
      }
      const rows = page.messages ?? [];
      const box = viewport.current;
      if (box)
        prepend.current = { height: box.scrollHeight, top: box.scrollTop };
      rows.forEach((row) => knownIds.current.add(row.id));
      historyCursor.current = rows[0] ?? historyCursor.current;
      setMessages((current) => mergeMessages(current, rows));
      setHasMore(page.hasMore ?? false);
    } catch {
      setError("Unable to load older messages. Please retry.");
    } finally {
      olderBusy.current = false;
      setLoadingOlder(false);
    }
  }

  return (
    <>
      <header className="ink-grain chat-header flex shrink-0 items-start gap-2 border-b border-sage/20 bg-ink px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-paper">
        <Link
          href="/messages"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control font-semibold"
          aria-label="Back to messages"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{otherName}</h1>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-h-5 text-small text-sage"
          >
            {activity.typing ? (
              <>
                <span className="sr-only">Typing</span>
                <span aria-hidden="true" className="inline-flex gap-1">
                  {[0, 1, 2].map((dot) => (
                    <span key={dot} className="h-1 w-1 rounded-full bg-sage" />
                  ))}
                </span>
              </>
            ) : activity.online ? (
              "online"
            ) : (
              ""
            )}
          </p>
          <RouteStub from={journeyFrom} to={journeyTo} compact tone="dark" />
          <p className="mt-1 font-mono-data text-xs text-sage">
            {journeyLabel}
          </p>
        </div>
        <ChatSafetyControls requestId={requestId} onBlocked={safety.block} />
      </header>
      <ChatSafetyBanner requestId={requestId} userId={userId} />
      <ChatHandover key={requestId} requestId={requestId} />
      {(connection || activityError) && (
        <div
          role="status"
          className="flex shrink-0 items-center justify-between gap-2 bg-deep/5 px-4 py-2 text-sm text-deep"
        >
          <span>{connection || activityError}</span>
          <button
            type="button"
            className="min-h-11 min-w-11 px-2 font-semibold underline"
            onClick={() => {
              setActivityError("");
              setRetryConnection((value) => value + 1);
            }}
          >
            Reconnect
          </button>
        </div>
      )}
      {receipts.error && (
        <p
          role="status"
          className="shrink-0 bg-deep/5 px-4 py-2 text-sm text-deep"
        >
          {receipts.error}{" "}
          <button
            type="button"
            onClick={receipts.retry}
            className="min-h-11 min-w-11 px-2 font-semibold underline"
          >
            Retry receipts
          </button>
        </p>
      )}
      <div
        ref={viewport}
        tabIndex={0}
        aria-label="Chat messages"
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 [overflow-anchor:none]"
        onScroll={() => {
          const box = viewport.current;
          if (!box) return;
          stickToBottom.current =
            box.scrollHeight - box.scrollTop - box.clientHeight < 80;
          if (stickToBottom.current) setNewMessages(false);
        }}
      >
        {hasMore && (
          <div className="text-center">
            <button
              type="button"
              disabled={loadingOlder}
              aria-busy={loadingOlder}
              onClick={older}
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-sage/30 bg-paper px-4 text-sm font-semibold disabled:opacity-60"
            >
              {loadingOlder ? "Loading…" : "Load older"}
            </button>
          </div>
        )}
        {loadingOlder && <ListSkeleton kind="chat" rows={2} />}
        {!messages.length && (
          <p className="py-12 text-center text-deep">
            No messages yet. Say hello to start the conversation.
          </p>
        )}
        <ol aria-label="Messages" className="space-y-3">
          {messages.map((message, index) => {
            const mine = message.sender_id === userId;
            const showDay =
              index === 0 ||
              new Date(message.created_at).toISOString().slice(0, 10) !==
                new Date(messages[index - 1].created_at)
                  .toISOString()
                  .slice(0, 10);
            return (
              <li key={message.id}>
                {showDay && (
                  <p
                    suppressHydrationWarning
                    className="my-5 text-center text-xs font-medium text-deep"
                  >
                    {dayLabel(message.created_at)}
                  </p>
                )}
                <div
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className="min-w-0 max-w-[85%] sm:max-w-[70%]">
                    <div
                      className={`overflow-hidden rounded-card ${mine ? "bg-signal text-ink" : "border border-deep/30 bg-paper text-ink"}`}
                    >
                      {message.media_type && (
                        <ChatMedia
                          message={message}
                          signed={
                            message.media_path
                              ? mediaUrls[message.media_path]
                              : undefined
                          }
                          onRetry={() => {
                            if (message.media_path)
                              retryMediaUrl(message.media_path);
                          }}
                          onLoad={() => {
                            if (stickToBottom.current && viewport.current)
                              viewport.current.scrollTop =
                                viewport.current.scrollHeight;
                          }}
                        />
                      )}
                      {message.body && (
                        <p className="whitespace-pre-wrap break-words px-4 py-3 [overflow-wrap:anywhere]">
                          {message.body}
                        </p>
                      )}
                    </div>
                    <div
                      className={`mt-1 flex flex-wrap items-center gap-2 text-xs text-sage ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <span className="sr-only">
                        {mine ? "You" : "Other participant"}
                      </span>
                      <time
                        suppressHydrationWarning
                        dateTime={message.created_at}
                        className="font-mono-data"
                      >
                        {new Date(message.created_at).toLocaleTimeString(
                          "en-GB",
                          {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "UTC",
                          },
                        )}
                      </time>
                      {!message.delivery && (
                        <ChatSafetyControls
                          requestId={requestId}
                          messageId={message.id}
                        />
                      )}
                      {mine && !message.delivery && (
                        <span
                          aria-label={message.read_at ? "Read" : "Sent"}
                          title={message.read_at ? "Read" : "Sent"}
                          className={
                            message.read_at
                              ? "font-semibold text-signal"
                              : "text-sage"
                          }
                        >
                          {message.read_at ? "✓✓" : "✓"}
                        </span>
                      )}
                      {message.delivery === "sending" && (
                        <span
                          role="status"
                          className="inline-flex items-center gap-1"
                        >
                          <Spinner />
                          Sending…
                        </span>
                      )}
                      {message.delivery === "failed" && (
                        <button
                          type="button"
                          className="min-h-11 min-w-11 px-2 font-semibold text-danger underline"
                          disabled={!canSend}
                          onClick={() => {
                            setError("");
                            void deliver(message);
                          }}
                        >
                          Failed · Retry
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {newMessages && (
        <div className="pointer-events-none relative h-0">
          <button
            type="button"
            className="pointer-events-auto absolute bottom-3 left-1/2 min-h-11 -translate-x-1/2 whitespace-nowrap rounded-control bg-deep px-5 text-sm font-semibold text-paper"
            onClick={() => {
              stickToBottom.current = true;
              if (viewport.current)
                viewport.current.scrollTop = viewport.current.scrollHeight;
              setNewMessages(false);
            }}
          >
            New messages ↓
          </button>
        </div>
      )}
      {!canSend ? (
        <div
          role="status"
          className="shrink-0 border-t border-sage/30 bg-paper p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <p className="font-medium">
            You can&apos;t send messages in this chat
          </p>
          {safety.state === "locked" && (
            <p className="mt-1 text-sm text-deep">
              New messages close seven days after the journey. Your history is
              still available.
            </p>
          )}
          {safety.error && (
            <p className="mt-1 text-sm text-danger">{safety.error}</p>
          )}
          <button
            type="button"
            onClick={safety.refresh}
            className="min-h-11 text-sm font-semibold underline"
          >
            Check again
          </button>
        </div>
      ) : (
        <form
          className="shrink-0 border-t border-sage/30 bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {error && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {error}
            </p>
          )}
          <label htmlFor="chat-message" className="sr-only">
            Message
          </label>
          <div className="flex items-end gap-2">
            <ChatAttachments onSend={queueMedia} onError={setError} />
            <textarea
              id="chat-message"
              ref={textarea}
              rows={1}
              maxLength={2000}
              value={draft}
              placeholder="Write a message…"
              aria-describedby="message-help"
              className="min-h-11 max-h-28 min-w-0 flex-1 resize-none rounded-control border border-deep/30 bg-paper px-3 py-2 text-base leading-6"
              onBlur={() => activityRef.current?.stop()}
              onChange={(event) => {
                setDraft(event.target.value);
                activityRef.current?.input(Boolean(event.target.value.trim()));
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  window.matchMedia("(hover: hover) and (pointer: fine)")
                    .matches
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="min-h-11 shrink-0 rounded-control bg-signal px-4 font-semibold text-ink disabled:bg-sage/30 disabled:text-deep disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          <p id="message-help" className="mt-2 text-xs text-deep">
            Times in UTC. Up to 2,000 characters. On desktop: Enter to send,
            Shift+Enter for a new line.
          </p>
        </form>
      )}
    </>
  );
}

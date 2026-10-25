"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LocalMessage } from "@/lib/chat/types";
import type { SignedMedia } from "@/lib/chat/use-media-urls";
import { formatBytes } from "@/lib/chat/media";
import { Spinner } from "@/components/spinner";

export function ChatMedia({
  message,
  signed,
  onRetry,
  onLoad,
}: {
  message: LocalMessage;
  signed?: SignedMedia;
  onRetry: () => void;
  onLoad: () => void;
}) {
  const [viewer, setViewer] = useState(false);
  const [broken, setBroken] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const url =
    message.localMediaUrl ||
    (signed?.expiresAt && signed.expiresAt > Date.now()
      ? signed.url
      : undefined);
  useEffect(() => setBroken(false), [url]);
  useEffect(() => {
    if (message.media_type === "document") onLoad();
  }, [url, signed?.error, message.media_type, onLoad]);
  useEffect(() => {
    if (viewer && url) dialog.current?.showModal();
  }, [viewer, url]);
  function close() {
    dialog.current?.close();
    setViewer(false);
    opener.current?.focus();
  }
  return (
    <div
      data-media-path={!message.delivery ? message.media_path : undefined}
      className="w-64 max-w-full overflow-hidden rounded-card text-ink"
    >
      {message.media_type === "document" ? (
        <div className="p-3">
          <div aria-hidden="true" className="text-2xl">
            ▤
          </div>
          <p className="mt-2 break-all text-sm font-semibold">
            {message.media_name || "Document.pdf"}
          </p>
          <p className="text-xs text-deep">
            PDF · {formatBytes(message.media_size)}
          </p>
          {url && !message.delivery && (
            <a
              href={url}
              download={message.media_name || true}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 min-w-11 items-center font-semibold text-deep underline"
            >
              Download
            </a>
          )}
        </div>
      ) : url && !broken ? (
        message.media_type === "video" ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label={message.media_name || "Video attachment"}
            className="aspect-[4/3] w-full rounded-card bg-ink object-contain"
            onLoadedMetadata={onLoad}
            onError={() => setBroken(true)}
          />
        ) : (
          <button
            ref={opener}
            type="button"
            aria-label={`Open image ${message.media_name || "attachment"}`}
            className="chat-image-trigger block min-h-11 min-w-11 w-full"
            onClick={() => setViewer(true)}
          >
            <Image
              unoptimized
              width={1600}
              height={1200}
              src={url}
              alt={message.media_name || "Shared image"}
              loading="lazy"
              className="aspect-[4/3] h-auto w-full rounded-card object-cover"
              onLoad={onLoad}
              onError={() => setBroken(true)}
            />
          </button>
        )
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center text-sm text-deep">
          {message.delivery ? "Attachment preview" : "Private attachment"}
        </div>
      )}
      {!message.delivery && (!url || broken) && (
        <div className="p-3 text-sm">
          {signed?.error || broken ? (
            <>
              <p role="status">
                {broken
                  ? "Unable to display this media. For MOV videos, your browser may not support the codec."
                  : signed?.error}
              </p>
              <button
                type="button"
                onClick={() => {
                  setBroken(false);
                  onRetry();
                }}
                className="min-h-11 min-w-11 font-semibold text-deep underline"
              >
                Reload attachment
              </button>
              {broken && url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 inline-flex min-h-11 min-w-11 items-center underline"
                >
                  Open file
                </a>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Loading private media…
            </span>
          )}
        </div>
      )}
      {message.delivery === "uploading" && (
        <div className="p-3">
          <label className="text-xs font-medium">
            Uploading {message.uploadProgress ?? 0}%
            <progress
              aria-label="Attachment upload progress"
              max={100}
              value={message.uploadProgress ?? 0}
              className="mt-1 block w-full accent-deep"
            />
          </label>
        </div>
      )}
      {viewer &&
        url &&
        createPortal(
          <dialog
            ref={dialog}
            onCancel={close}
            onClose={() => {
              setViewer(false);
              opener.current?.focus();
            }}
            aria-label="Full-screen image viewer"
            className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-ink p-4 font-ui text-paper backdrop:bg-ink"
          >
            <button
              type="button"
              autoFocus
              onClick={close}
              className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 min-h-11 rounded-control bg-paper px-4 font-semibold text-ink"
            >
              Close image
            </button>
            <div className="flex h-full items-center justify-center">
              <Image
                unoptimized
                width={1600}
                height={1200}
                src={url}
                alt={message.media_name || "Shared image"}
                className="h-auto w-auto max-h-[85dvh] max-w-full object-contain"
              />
            </div>
          </dialog>,
          document.body,
        )}
    </div>
  );
}

"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { prepareMedia } from "@/lib/chat/prepare-media";
import { formatBytes, validateFile } from "@/lib/chat/media";
import { Spinner } from "@/components/spinner";

export function ChatAttachments({
  onSend,
  onError,
}: {
  onSend: (file: File, caption: string) => void;
  onError: (message: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState("");
  const gallery = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    dialog.current?.showModal();
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (!menuRoot.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);
  async function choose(selected?: File) {
    setMenu(false);
    if (!selected) return;
    const invalid = validateFile(selected);
    if (invalid) {
      onError(invalid);
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareMedia(selected);
      if (mounted.current) {
        setCaption("");
        setFile(prepared);
      }
    } catch (error) {
      if (mounted.current)
        onError(
          error instanceof Error
            ? error.message
            : "Couldn't prepare this file. Try another.",
        );
    } finally {
      if (mounted.current) setPreparing(false);
    }
  }
  function close() {
    dialog.current?.close();
    setFile(null);
    setPreview("");
    trigger.current?.focus();
  }
  return (
    <div
      ref={menuRoot}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setMenu(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Attach a file"
        aria-expanded={menu}
        aria-controls="chat-attachment-menu"
        disabled={preparing}
        onClick={() => setMenu(!menu)}
        className="flex h-11 w-11 items-center justify-center rounded-control border border-deep/30 text-sage disabled:opacity-60"
      >
        {preparing ? (
          <Spinner />
        ) : (
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5L13 2.5a4 4 0 0 1 5.5 5.8L9.8 17a2 2 0 0 1-2.8-2.8L15 6" />
          </svg>
        )}
      </button>
      {preparing && (
        <span role="status" className="sr-only">
          Preparing attachment…
        </span>
      )}
      {menu && (
        <div
          id="chat-attachment-menu"
          aria-label="Attachment options"
          className="absolute bottom-14 left-0 z-10 w-60 rounded-control border bg-paper p-2 "
        >
          <button
            type="button"
            className="min-h-12 w-full rounded-control px-3 text-left hover:bg-sage/15"
            onClick={() => gallery.current?.click()}
          >
            Photo / Video from gallery
          </button>
          <button
            type="button"
            className="min-h-12 w-full rounded-control px-3 text-left hover:bg-sage/15"
            onClick={() => documentInput.current?.click()}
          >
            Document (PDF)
          </button>
        </div>
      )}
      <input
        ref={gallery}
        type="file"
        className="hidden"
        aria-label="Choose photo or video"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,.mov"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          void choose(selected);
        }}
      />
      <input
        ref={documentInput}
        type="file"
        className="hidden"
        aria-label="Choose PDF"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          void choose(selected);
        }}
      />
      {file &&
        createPortal(
          <dialog
            ref={dialog}
            aria-labelledby="attachment-preview-title"
            onCancel={close}
            onClose={() => {
              setFile(null);
              trigger.current?.focus();
            }}
            className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-card p-5 bg-paper font-ui text-ink backdrop:bg-ink/60"
          >
            <h2 id="attachment-preview-title" className="text-lg font-semibold">
              Preview attachment
            </h2>
            {preview && file.type.startsWith("image/") && (
              /* Blob previews must not go through the Next image proxy. */ <Image
                unoptimized
                width={1600}
                height={1200}
                src={preview}
                alt="Selected attachment preview"
                className="mx-auto mt-4 h-auto w-auto max-h-64 max-w-full rounded-control object-contain"
              />
            )}
            {preview && file.type.startsWith("video/") && (
              <video
                src={preview}
                controls
                preload="metadata"
                className="mt-4 max-h-64 w-full rounded-control"
              />
            )}
            <p className="mt-3 break-all font-medium">{file.name}</p>
            <p className="text-sm text-deep">{formatBytes(file.size)}</p>
            {file.type.startsWith("image/") && (
              <p className="mt-2 text-xs text-deep">
                Images are resized to 1600px maximum. Animated images are sent
                as a still frame.
              </p>
            )}
            <label
              htmlFor="attachment-caption"
              className="mt-4 block text-sm font-medium"
            >
              Caption (optional)
            </label>
            <textarea
              id="attachment-caption"
              autoFocus
              maxLength={2000}
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-2 w-full rounded-control border border-deep/30 p-3 text-base"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="min-h-11 rounded-control border px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSend(file, caption.trim());
                  close();
                }}
                className="min-h-11 rounded-control bg-signal px-5 font-semibold text-ink"
              >
                Send attachment
              </button>
            </div>
          </dialog>,
          document.body,
        )}
    </div>
  );
}

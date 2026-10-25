"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { blockChatUser, reportChat } from "@/app/chat/safety-actions";
import { Spinner } from "@/components/spinner";
export function ChatSafetyControls({
  requestId,
  messageId,
  onBlocked,
}: {
  requestId: string;
  messageId?: string;
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"report" | "block">("report");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  function launch(next: "report" | "block") {
    setMode(next);
    setError("");
    setSuccess("");
    setReason("");
    setOpen(true);
    if (details.current) details.current.open = false;
  }
  function close() {
    if (busy) return;
    dialog.current?.close();
    setOpen(false);
    details.current?.querySelector("summary")?.focus();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result =
        mode === "block"
          ? await blockChatUser(requestId)
          : await reportChat(requestId, messageId ?? null, reason);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success || "Done.");
        if (mode === "block") {
          onBlocked?.();
          window.dispatchEvent(new Event("chat-safety-changed"));
        }
      }
    } catch {
      setError("The action failed. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {messageId ? (
        <details ref={details} className="relative">
          <summary
            aria-label="Message options"
            className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-control text-lg hover:bg-sage/15"
          >
            ⋯
          </summary>
          <button
            ref={trigger}
            type="button"
            className="block min-h-11 whitespace-nowrap rounded-control border bg-paper px-3 text-sm text-danger"
            onClick={() => launch("report")}
          >
            Report message
          </button>
        </details>
      ) : (
        <details ref={details} className="relative ml-auto shrink-0">
          <summary
            aria-label="Conversation options"
            className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-control text-xl hover:bg-sage/15"
          >
            ⋯
          </summary>
          <div className="absolute right-0 top-12 z-40 w-52 rounded-control border bg-paper p-1 text-sm text-ink ">
            <button
              ref={trigger}
              type="button"
              className="min-h-11 w-full rounded-control px-3 text-left hover:bg-sage/15"
              onClick={() => launch("report")}
            >
              Report conversation
            </button>
            <button
              type="button"
              className="min-h-11 w-full rounded-control px-3 text-left text-danger hover:bg-danger/10"
              onClick={() => launch("block")}
            >
              Block user
            </button>
          </div>
        </details>
      )}
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClose={() => {
              setOpen(false);
              details.current?.querySelector("summary")?.focus();
            }}
            aria-labelledby={`safety-title-${messageId || requestId}`}
            className="w-[calc(100%_-_2rem)] max-h-[80dvh] max-w-md overflow-y-auto rounded-card p-5 bg-paper font-ui text-ink backdrop:bg-ink/50"
          >
            <form onSubmit={submit} className="space-y-4">
              <h2
                id={`safety-title-${messageId || requestId}`}
                className="text-xl font-semibold"
              >
                {mode === "block"
                  ? "Block user"
                  : messageId
                    ? "Report message"
                    : "Report conversation"}
              </h2>
              {success ? (
                <p role="status" className="text-deep">
                  {success}
                </p>
              ) : mode === "block" ? (
                <p className="text-sm text-deep">
                  Neither of you will be able to send messages to each other in
                  any chat. Existing conversations stay readable.
                </p>
              ) : (
                <label className="block text-sm font-medium">
                  Reason
                  <textarea
                    autoFocus
                    required
                    maxLength={2000}
                    rows={4}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-2 w-full rounded-control border border-deep/30 p-3 text-base"
                    placeholder="Tell us what happened"
                  />
                </label>
              )}
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={close}
                  className="min-h-11 rounded-control border px-4 disabled:opacity-50"
                >
                  {success ? "Close" : "Cancel"}
                </button>
                {!success && (
                  <button
                    type="submit"
                    disabled={busy || (mode === "report" && !reason.trim())}
                    className="inline-flex min-h-11 items-center gap-2 rounded-control bg-danger px-4 font-semibold text-ink disabled:opacity-50"
                  >
                    {busy && <Spinner />}
                    {busy
                      ? "Submitting…"
                      : mode === "block"
                        ? "Block user"
                        : "Submit report"}
                  </button>
                )}
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}

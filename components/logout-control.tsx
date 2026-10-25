"use client";

import { LogOut } from "lucide-react";
import { useRef, useState } from "react";
import { logout } from "@/app/auth-actions";
import { Button } from "@/components/ui/Button";

export function LogoutControl({ compact = false }: { compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirmLogout() {
    setPending(true);
    setError("");
    try {
      const result = await logout();
      if (!result.success) {
        setError(result.error || "We couldn't log you out. Please try again.");
        setPending(false);
        return;
      }
      // Discard the router cache, browser Supabase client and realtime state.
      window.location.replace("/login");
    } catch {
      setError("We couldn't log you out. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={
          compact
            ? "floating-nav-logout"
            : "w-full min-h-16 px-1 text-xs sm:text-sm"
        }
        aria-label="Logout"
        data-press={compact ? "primary" : undefined}
        aria-haspopup="dialog"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        {compact ? (
          <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          "Logout"
        )}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="logout-title"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-card border border-sage/20 bg-paper p-6 text-ink backdrop:bg-ink/60"
      >
        <h2 id="logout-title" className="text-h2">
          Log out of your account?
        </h2>
        {error && (
          <p role="alert" className="mt-4 text-small text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            ref={cancel}
            variant="ghost"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            loading={pending}
            loadingText="Logging out…"
            onClick={confirmLogout}
          >
            Logout
          </Button>
        </div>
      </dialog>
    </>
  );
}

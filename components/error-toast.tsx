"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

const ErrorContext = createContext<(message: string) => void>(() => {});

export function ErrorToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const notify = useCallback((text: string) => setMessage(text), []);
  const pathname = usePathname();
  useEffect(() => {
    setMessage("");
  }, [pathname]);
  return (
    <ErrorContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 px-4">
        <div
          className="ml-auto max-w-md"
          aria-live="assertive"
          aria-atomic="true"
        >
          {message && (
            <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-red-200 bg-white p-4 text-sm leading-6 text-red-900 shadow-lg">
              <p className="min-w-0 flex-1 break-words">{message}</p>
              <button
                type="button"
                onClick={() => setMessage("")}
                aria-label="Dismiss error notification"
                className="min-h-11 shrink-0 rounded-lg px-3 font-semibold hover:bg-red-50"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </ErrorContext.Provider>
  );
}

export function useErrorToast(state: { error?: string }) {
  const notify = useContext(ErrorContext);
  useEffect(() => {
    if (state.error) notify(state.error);
  }, [state, notify]);
}

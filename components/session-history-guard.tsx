"use client";

import { useEffect } from "react";

// A bfcache restore bypasses middleware. Hide its snapshot and revalidate by
// loading the document again before exposing any previously authenticated UI.
export function SessionHistoryGuard() {
  useEffect(() => {
    const hide = () => {
      document.documentElement.style.visibility = "hidden";
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
      else document.documentElement.style.removeProperty("visibility");
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
      document.documentElement.style.removeProperty("visibility");
    };
  }, []);
  return null;
}

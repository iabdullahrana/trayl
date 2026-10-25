"use client";
import { ErrorFallback } from "@/components/error-fallback";
import "./globals.css";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="px-4 py-10">
          <ErrorFallback reset={reset} />
        </main>
      </body>
    </html>
  );
}

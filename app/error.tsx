"use client";
import { ErrorFallback } from "@/components/error-fallback";
export default function PageError({ reset }: { reset: () => void }) {
  return <ErrorFallback reset={reset} />;
}

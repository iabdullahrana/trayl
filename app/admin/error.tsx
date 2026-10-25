"use client";
import { ErrorFallback } from "@/components/error-fallback";
export default function AdminError({ reset }: { reset: () => void }) {
  return <ErrorFallback reset={reset} title="Unable to load admin data" />;
}

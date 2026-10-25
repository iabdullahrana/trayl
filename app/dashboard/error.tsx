"use client";
import { ErrorFallback } from "@/components/error-fallback";
export default function DashboardError({ reset }: { reset: () => void }) {
  return <ErrorFallback reset={reset} title="Unable to load your dashboard" />;
}

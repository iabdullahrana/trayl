import { Spinner } from "@/components/spinner";
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-40 items-center justify-center gap-3 text-slate-600"
    >
      <Spinner />
      <span>Loading…</span>
    </div>
  );
}

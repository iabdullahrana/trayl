export function ListSkeleton({
  kind = "journeys",
  rows = 3,
}: {
  kind?: "journeys" | "inbox" | "chat";
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-label={`Loading ${kind}`}
      className="space-y-space-4 py-space-4"
    >
      <span className="sr-only">Loading {kind}...</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          aria-hidden="true"
          key={i}
          className={`skeleton-surface space-y-space-3 rounded-card border border-sage/20 p-space-4 ${kind === "chat" ? `w-2/3 ${i % 2 ? "ml-auto" : ""}` : ""}`}
        >
          <div className="h-4 w-1/3 rounded-control bg-sage/20" />
          <div className="flex items-center gap-space-3">
            <div className="h-4 w-1/4 rounded-control bg-sage/20" />
            <div className="flex-1 border-t border-dashed border-sage/30" />
            <div className="h-4 w-1/4 rounded-control bg-sage/20" />
          </div>
          {kind !== "chat" && (
            <div className="h-4 w-1/2 rounded-control bg-sage/20" />
          )}
        </div>
      ))}
    </div>
  );
}

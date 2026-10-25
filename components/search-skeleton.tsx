export function SearchSkeleton() {
  return (
    <div
      role="status"
      aria-label="Searching journeys"
      className="divide-y divide-sage/30 border-y border-sage/30"
    >
      <span className="sr-only">Searching journeys...</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden="true"
          className="skeleton-surface space-y-space-4 py-space-6"
        >
          <div className="flex items-center justify-between gap-space-4">
            <span className="h-8 w-24 rounded-control bg-sage/25" />
            <span className="h-5 w-28 rounded-control bg-sage/20" />
          </div>
          <div className="flex items-center gap-space-3">
            <span className="h-5 w-24 rounded-control bg-sage/25" />
            <span className="flex-1 border-t border-dashed border-sage/50" />
            <span className="h-5 w-24 rounded-control bg-sage/25" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-space-4">
            <span className="h-5 w-32 rounded-control bg-sage/20" />
            <span className="h-12 w-full rounded-control bg-sage/20 sm:w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

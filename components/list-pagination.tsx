"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
export function ListPagination({
  page,
  hasMore,
  parameter = "page",
}: {
  page: number;
  hasMore: boolean;
  parameter?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (next: number) => {
    const query = new URLSearchParams(params.toString());
    query.set(parameter, String(next));
    return `${pathname}?${query}`;
  };
  if (page === 1 && !hasMore) return null;
  const style =
    "inline-flex min-h-11 items-center rounded-control border border-deep px-4 text-small text-deep focus-visible:outline-deep";
  return (
    <nav
      aria-label="List pagination"
      className="mt-4 flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link prefetch={false} href={href(page - 1)} className={style}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-deep">Page {page}</span>
      {hasMore ? (
        <Link prefetch={false} href={href(page + 1)} className={style}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

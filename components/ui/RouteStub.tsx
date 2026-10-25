import type { HTMLAttributes, ReactNode } from "react";
export type RouteStubProps = HTMLAttributes<HTMLDivElement> & {
  fromContent?: ReactNode;
  toContent?: ReactNode;
  compact?: boolean;
  tone?: "light" | "dark";
  from: string;
  to: string;
  glyph?: "arrow" | "plane" | "none";
};
export function RouteStub({
  fromContent,
  toContent,
  compact = false,
  tone = "light",
  from,
  to,
  glyph = "none",
  className = "",
  ...props
}: RouteStubProps) {
  return (
    <div
      className={`flex min-w-0 items-center ${compact ? "gap-space-2 text-small" : "gap-space-3 text-mono-data"} font-mono-data ${tone === "dark" ? "text-paper" : "text-ink"} ${className}`}
      {...props}
    >
      <span
        className={`min-w-0 flex-1 ${compact ? "truncate" : "break-words"}`}
        title={from}
      >
        <span className="sr-only">From </span>
        {fromContent ?? from}
      </span>
      <span
        aria-hidden="true"
        className={`flex min-w-8 flex-1 items-center ${tone === "dark" ? "text-sage" : "text-deep"}`}
      >
        <span
          className={`flex-1 border-t border-dashed ${tone === "dark" ? "border-sage/50" : "border-deep/40"}`}
        />
        {glyph !== "none" && (
          <span className="px-space-2">
            {glyph === "plane" ? "\u2708" : "\u2192"}
          </span>
        )}
        <span
          className={`flex-1 border-t border-dashed ${tone === "dark" ? "border-sage/50" : "border-deep/40"}`}
        />
      </span>
      <span
        className={`min-w-0 flex-1 text-right ${compact ? "truncate" : "break-words"}`}
        title={to}
      >
        <span className="sr-only">To </span>
        {toContent ?? to}
      </span>
    </div>
  );
}

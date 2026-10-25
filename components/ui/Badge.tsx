import type { HTMLAttributes } from "react";
const variants = {
  inactive: "border-sage bg-sage/20",
  open: "border-amber bg-amber/20",
  reviewed: "border-sage bg-sage/20",
  unread: "border-signal bg-signal",
  document: "border-deep/20 bg-deep/5",
  package: "border-deep/20 bg-deep/5",
  active: "border-signal bg-signal/15",
  pending: "border-amber bg-amber/20",
  accepted: "border-signal bg-signal/15",
  cancelled: "border-danger bg-danger/15",
  declined: "border-danger bg-danger/15",
  completed: "border-sage bg-sage/20",
};
export type BadgeStatus = keyof typeof variants;
export function Badge({
  variant,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant: BadgeStatus }) {
  // Ink labels retain contrast; color and readable text both communicate status.
  return (
    <span
      className={`inline-flex items-center rounded-full border px-space-3 py-space-1 ${variant === "document" || variant === "package" ? "font-ui text-small" : "font-mono-data text-mono-data"} capitalize text-ink ${variants[variant]} ${className}`}
      {...props}
    >
      {children ?? variant}
    </span>
  );
}

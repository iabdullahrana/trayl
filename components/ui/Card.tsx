import type { HTMLAttributes } from "react";
export function Card({
  className = "",
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "row" }) {
  return (
    <div
      className={`min-w-0 bg-paper font-ui text-ink ${variant === "row" ? "py-space-6" : "rounded-card border border-sage/20 p-space-4 sm:p-space-6"} ${className}`}
      {...props}
    />
  );
}

import { Spinner } from "@/components/spinner";
import { forwardRef, type ButtonHTMLAttributes } from "react";

const variants = {
  danger: "border-danger bg-transparent text-danger hover:bg-danger/10",
  primary: "border-transparent bg-signal text-ink hover:bg-signal/80",
  secondary: "border-deep bg-transparent text-deep hover:bg-deep/10",
  ghost: "border-transparent bg-transparent text-ink hover:bg-sage/20",
};
const sizes = {
  sm: "min-h-11 px-space-3 py-space-2 text-small",
  md: "min-h-12 px-space-4 py-space-3 text-body",
  lg: "min-h-14 px-space-6 py-space-4 text-body",
};
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  loadingText?: string;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      type = "button",
      className = "",
      loading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        data-press={variant === "primary" ? "primary" : undefined}
        type={type}
        className={`inline-flex min-w-11 break-words items-center justify-center gap-space-2 rounded-control border font-ui font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep focus-visible:ring-2 focus-visible:ring-paper disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
        disabled={disabled || loading}
        aria-busy={loading || props["aria-busy"]}
      >
        {loading && <Spinner />}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  },
);

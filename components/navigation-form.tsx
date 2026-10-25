"use client";

import { useTransition, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";

export function NavigationForm({
  action,
  children,
  className,
  label = "Search",
  pendingLabel = "Searching…",
}: {
  action: string;
  children: ReactNode;
  className?: string;
  label?: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const query = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) =>
      query.append(key, String(value)),
    );
    const [path, hash] = action.split("#");
    startTransition(() => {
      router.push(`${path}?${query}${hash ? `#${hash}` : ""}`);
      router.refresh();
    });
  }
  return (
    <form
      action={action}
      method="get"
      onSubmit={submit}
      className={className}
      aria-busy={pending}
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
      >
        {pending && <Spinner />}
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

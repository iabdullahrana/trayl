"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Spinner } from "@/components/spinner";

export function ErrorFallback({
  reset,
  title = "Something went wrong",
}: {
  reset: () => void;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <section
      role="alert"
      className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 sm:p-8"
    >
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-3 text-slate-600">
        We couldn’t load this page. Please try again in a moment.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() => startTransition(reset)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending && <Spinner />}
          {pending ? "Trying again…" : "Try again"}
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold underline"
        >
          Go home
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";
export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-slate-600">
        This page isn’t available. Find an upcoming journey or head back home.
      </p>
      <div className="mt-5 flex flex-wrap gap-4">
        <Link
          href="/search"
          className="inline-flex min-h-12 items-center rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Search journeys
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-semibold underline"
        >
          Go home
        </Link>
      </div>
    </section>
  );
}

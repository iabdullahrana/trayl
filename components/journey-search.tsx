"use client";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RouteStub } from "@/components/ui/RouteStub";
import { SearchSkeleton } from "@/components/search-skeleton";
import { useErrorToast } from "@/components/error-toast";

import { AnimatedCount } from "@/components/ui/AnimatedCount";
import { EmptyTicket } from "@/components/ui/EmptyTicket";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useId,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavigationForm } from "@/components/navigation-form";
import { useFormState, useFormStatus } from "react-dom";
import { requestConnection } from "@/app/search/actions";
import {
  parseSearch,
  searchKey,
  type SearchFilters,
  type SearchResult,
  type SearchJourney,
} from "@/lib/journeys/search";

export function SearchForm({ filters }: { filters: SearchFilters }) {
  return (
    <NavigationForm
      key={searchKey(filters)}
      action="/search"
      className="my-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
    >
      {(
        [
          { name: "from", label: "From city", type: "text" },
          { name: "to", label: "To city", type: "text" },
          { name: "date", label: "Date", type: "date" },
        ] as const
      ).map(({ name, label, type }) => (
        <div key={name} className="min-w-0">
          <label
            htmlFor={`search-${name}`}
            className="mb-2 block text-sm font-medium"
          >
            {label}
          </label>
          {name !== "date" ? (
            <CityCombobox
              id={`search-${name}`}
              key={`${name}-${filters[name]}`}
              name={name}
              defaultValue={filters[name]}
              placeholder={name === "from" ? "Lahore" : "Islamabad"}
            />
          ) : (
            <input
              id={`search-${name}`}
              name={name}
              type={type}
              defaultValue={filters[name]}
              required={name === "date"}

              autoComplete="off"
              className="inline-flex items-center justify-center gap-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3 py-3 text-base focus:outline-slate-900"
            />
          )}
        </div>
      ))}
    </NavigationForm>
  );
}

export function TicketSearchForm({
  filters,
  today,
}: {
  filters: SearchFilters;
  today: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const name of ["from", "to", "date"])
      query.set(name, String(data.get(name) || ""));
    startTransition(() => {
      router.push(`/search?${query}`);
    });
  }
  return (
    <div className="my-space-6">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-space-3 rounded-control border border-deep/30 px-space-3 py-space-3 text-left text-small focus-visible:outline-deep md:hidden"
      >
        <span className="min-w-0 break-words">
          <span className="font-semibold">
            {filters.from || "Anywhere"} → {filters.to || "Anywhere"}
          </span>
          <span className="block text-deep">
            {filters.date === today ? "Today" : filters.date}
          </span>
        </span>
        <span className="shrink-0 font-semibold">
          {expanded ? "Close" : "Edit"}
        </span>
      </button>
      <form
        id={id}
        action="/search"
        method="get"
        onSubmit={submit}
        aria-busy={pending}
        className={`${expanded ? "grid" : "hidden"} mt-space-3 gap-space-4 md:mt-0 md:grid md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] md:items-end`}
      >
        {(
          [
            { name: "from", label: "From city", type: "text" },
            { name: "to", label: "To city", type: "text" },
            { name: "date", label: "Date", type: "date" },
          ] as const
        ).map(({ name, label, type }) => (
          <label
            key={name}
            className="flex min-w-0 flex-col gap-space-2 text-small font-semibold"
          >
            {label}
            {name !== "date" ? (
              <CityCombobox
                id={`search-${name}`}
                key={`${name}-${filters[name]}`}
                name={name}
                defaultValue={filters[name]}
                placeholder={name === "from" ? "Lahore" : "Islamabad"}
              />
            ) : (
              <input
                name={name}
                type={type}
                defaultValue={filters[name]}
                required={name === "date"}

                className="min-h-12 w-full min-w-0 max-w-full rounded-control border border-deep/30 bg-paper px-space-3 py-space-3 text-body font-normal focus-visible:outline-deep"
              />
            )}
          </label>
        ))}
        <Button type="submit" disabled={pending}>
          {pending ? "Searching..." : "Search journeys"}
        </Button>
      </form>
      {pending && (
        <div className="filter-pending mt-space-6">
          <SearchSkeleton />
        </div>
      )}
    </div>
  );
}

function ConnectButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      loadingText="Sending..."
      className="w-full"
    >
      Request to Connect
    </Button>
  );
}

function JourneyCard({
  journey,
  userId,
}: {
  journey: SearchJourney;
  userId: string | null;
}) {
  const [state, action] = useFormState(requestConnection, {});
  useErrorToast(state);
  return (
    <li>
      <Card variant="row">
        <div className="mb-space-4 flex flex-wrap items-center justify-between gap-space-3">
          <div>
            <p className="text-small text-deep">Departs (UTC)</p>
            <time
              dateTime={journey.travel_time}
              className="font-mono-data text-h1 font-medium"
            >
              {journey.travel_time.slice(0, 5)}
            </time>
          </div>
          <time
            dateTime={journey.travel_date}
            className="font-mono-data text-mono-data text-deep"
          >
            {journey.travel_date}
          </time>
        </div>
        <RouteStub
          from={journey.from_city}
          to={journey.to_city}
          glyph="arrow"
        />
        <div className="mt-space-4 flex flex-col gap-space-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-space-2 break-words font-semibold">
              {journey.traveller_name}
            </p>
            <Badge variant={journey.item_type}>
              {journey.item_type === "document" ? "Document" : "Small Package"}
            </Badge>
          </div>
          <div className="w-full sm:w-56 sm:shrink-0">
            {!userId ? (
              <form action="/login" method="get">
                <Button type="submit" className="w-full">
                  Request to Connect
                </Button>
              </form>
            ) : userId === journey.traveller_id ? (
              <p className="text-small text-deep">Your journey</p>
            ) : state.success ? (
              <p role="status" className="text-small text-deep">
                {state.success}
              </p>
            ) : (
              <form action={action}>
                <input type="hidden" name="journey_id" value={journey.id} />
                <ConnectButton />
                {state.error && (
                  <p role="alert" className="mt-space-2 text-small text-danger">
                    {state.error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

export function SearchResults({
  initialFilters,
  initialResult,
  today,
  userId,
}: {
  initialFilters: SearchFilters;
  initialResult: SearchResult;
  today: string;
  userId: string | null;
}) {
  const params = useSearchParams();
  const parsed = parseSearch(params, today);
  const key = searchKey(parsed.filters);
  const lastRetry = useRef(0);
  const [result, setResult] = useState({
    key: searchKey(initialFilters),
    data: initialResult,
  });
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (key === searchKey(initialFilters) && retry === lastRetry.current) {
      setResult({ key, data: initialResult });
      setLoading(false);
      return;
    }
    lastRetry.current = retry;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    fetch(`/api/journeys/search?${key}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data: SearchResult = await response.json();
        if (!response.ok && !data.error) throw new Error("Search failed");
        if (active) setResult({ key, data });
      })
      .catch(() => {
        if (active)
          setResult({
            key,
            data: {
              journeys: [],
              error: "Unable to load journeys. Please try again.",
            },
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, retry, initialResult, initialFilters]);
  const busy = loading || result.key !== key;
  return (
    <div className="search-results" aria-live="polite" aria-busy={busy}>
      <p
        hidden={
          busy || Boolean(result.data.error) || !result.data.journeys.length
        }
        className="mb-space-3 text-small text-deep"
      >
        <AnimatedCount value={result.data.journeys.length} />{" "}
        {result.data.journeys.length === 1 ? "journey" : "journeys"}{" "}
        {parsed.filters.from && parsed.filters.to
          ? "on this route"
          : "matching your search"}{" "}
        {parsed.filters.date === today ? "today" : `on ${parsed.filters.date}`}{" "}
        · Earliest departure first
      </p>
      {busy ? (
        <SearchSkeleton />
      ) : result.data.error ? (
        <div
          role="alert"
          className="rounded-control border border-danger/30 p-space-4 text-danger"
        >
          <p>{result.data.error}</p>
          <Button
            variant="secondary"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-space-3"
          >
            Try again
          </Button>
        </div>
      ) : result.data.journeys.length === 0 ? (
        <Card className="space-y-space-4">
          <EmptyTicket />
          <h2 className="text-h2 font-semibold">
            No travellers on this route{" "}
            {parsed.filters.date === today
              ? "today"
              : `on ${parsed.filters.date}`}
            .
          </h2>
          <p className="text-deep">
            Try a different date. Already heading that way? Post your journey so
            others can find it.
          </p>
          <Link
            href="/post-journey"
            className="inline-flex min-h-12 items-center justify-center rounded-control bg-signal px-space-4 py-space-3 font-semibold text-ink focus-visible:outline-deep"
          >
            Post a journey
          </Link>
        </Card>
      ) : (
        <>
          <ul className="divide-y divide-sage/30 border-y border-sage/30">
            {[...result.data.journeys]
              .sort(
                (a, b) =>
                  a.travel_time.localeCompare(b.travel_time) ||
                  a.id.localeCompare(b.id),
              )
              .map((journey) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  userId={userId}
                />
              ))}
          </ul>
          <ListPagination
            page={Number(parsed.filters.page) || 1}
            hasMore={Boolean(result.data.hasMore)}
          />
        </>
      )}
    </div>
  );
}

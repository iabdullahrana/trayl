import type { Metadata } from "next";
import { TicketSearchForm, SearchResults } from "@/components/journey-search";
import { parseSearch } from "@/lib/journeys/search";
import { searchJourneys } from "@/lib/journeys/search-server";
import { todayUTC } from "@/lib/journeys/validation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Search journeys | Trayl" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const today = todayUTC();
  const { filters, error } = parseSearch(
    {
      get: (name) => {
        const value = searchParams[name];
        return typeof value === "string" ? value : (value?.[0] ?? null);
      },
    },
    today,
  );
  const [initialResult, userId] = await Promise.all([
    error ? Promise.resolve({ journeys: [], error }) : searchJourneys(filters),
    getSupabaseConfig()
      ? createClient()
          .auth.getUser()
          .then(({ data }) => data.user?.id ?? null)
      : Promise.resolve(null),
  ]);
  return (
    <section className="search-screen bg-paper px-space-4 py-space-6 font-ui text-body text-ink sm:px-space-6 sm:py-space-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-h1 font-semibold tracking-tight">
          Find a traveller
        </h1>
        <p className="mt-space-2 text-small text-deep">
          Search upcoming journeys and request to connect.
        </p>
        <TicketSearchForm
          key={`${filters.from}/${filters.to}/${filters.date}`}
          filters={filters}
          today={today}
        />
        <SearchResults
          initialFilters={filters}
          initialResult={initialResult}
          today={today}
          userId={userId}
        />
      </div>
    </section>
  );
}

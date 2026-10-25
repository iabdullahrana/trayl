import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type {
  SearchFilters,
  SearchJourney,
  SearchResult,
} from "@/lib/journeys/search";

export async function searchJourneys(
  filters: SearchFilters,
): Promise<SearchResult> {
  if (!getSupabaseConfig())
    return {
      journeys: [],
      error: "Journey search is currently unavailable. Please try again later.",
    };
  try {
    const page = Math.max(1, Math.min(100000, Number(filters.page) || 1));
    const { data, error } = await createClient()
      .rpc("search_journeys", {
        search_from: filters.from,
        search_to: filters.to,
        search_date: filters.date,
      })
      .order("travel_time")
      .order("id")
      .range((page - 1) * 20, page * 20);
    if (error)
      return {
        journeys: [],
        error: "We couldn't load journeys. Please try again.",
      };
    return {
      journeys: (data ?? []).slice(0, 20) as SearchJourney[],
      hasMore: (data?.length ?? 0) > 20,
    };
  } catch {
    return {
      journeys: [],
      error: "Unable to reach journey search. Please try again.",
    };
  }
}

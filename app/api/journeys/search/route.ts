import { NextRequest, NextResponse } from "next/server";
import { parseSearch } from "@/lib/journeys/search";
import { searchJourneys } from "@/lib/journeys/search-server";
import { todayUTC } from "@/lib/journeys/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { filters, error } = parseSearch(
    request.nextUrl.searchParams,
    todayUTC(),
  );
  const result = error
    ? { journeys: [], error }
    : await searchJourneys(filters);
  return NextResponse.json(result, {
    status: error ? 400 : result.error ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

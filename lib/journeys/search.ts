export type SearchFilters = {
  from: string;
  to: string;
  date: string;
  page?: string;
};
export type SearchJourney = {
  id: string;
  traveller_id: string;
  traveller_name: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  travel_time: string;
  item_type: "document" | "package";
};
export type SearchResult = {
  journeys: SearchJourney[];
  error?: string;
  hasMore?: boolean;
};

export function parseSearch(
  params: { get(name: string): string | null },
  today: string,
): { filters: SearchFilters; error?: string } {
  const filters = {
    page: /^\d+$/.test(params.get("page") || "")
      ? String(Math.max(1, Math.min(100000, Number(params.get("page")))))
      : "1",
    from: (params.get("from") ?? "").trim().replace(/\s+/g, " "),
    to: (params.get("to") ?? "").trim().replace(/\s+/g, " "),
    date: params.get("date") || today,
  };
  const date = new Date(`${filters.date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(filters.date) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== filters.date
  )
    return { filters, error: "Choose a valid date." };
  if (filters.from.length > 100 || filters.to.length > 100)
    return { filters, error: "City names must be 100 characters or fewer." };
  return { filters };
}

export function searchKey(filters: SearchFilters) {
  return new URLSearchParams(filters).toString();
}

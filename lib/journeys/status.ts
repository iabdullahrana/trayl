export type OwnedJourney = {
  id: string;
  created_at?: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  travel_time: string;
  item_type: "document" | "package";
  status: "active" | "completed" | "cancelled";
};

export function isPastJourney(
  journey: Pick<OwnedJourney, "travel_date" | "travel_time">,
  now: number,
) {
  return Date.parse(`${journey.travel_date}T${journey.travel_time}Z`) <= now;
}

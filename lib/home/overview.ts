import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OwnedJourney } from "@/lib/journeys/status";
export type HomeRequest = {
  id: string;
  sender_id: string;
  senderName: string;
  journeys: {
    from_city: string;
    to_city: string;
    travel_date: string;
    travel_time: string;
  };
};
export type HomeOverview = {
  journeys: OwnedJourney[];
  requests: HomeRequest[];
  journeysError?: string;
  requestsError?: string;
};

// Called only by the authenticated server home. Both lists are bounded at the database.
export async function getHomeOverview(
  userId: string,
  now = new Date(),
): Promise<HomeOverview> {
  const result: HomeOverview = { journeys: [], requests: [] };
  const supabase = createClient();
  const date = now.toISOString().slice(0, 10),
    time = now.toISOString().slice(11, 19);
  const [journeys, requests] = await Promise.allSettled([
    Promise.resolve().then(() =>
      supabase
        .from("journeys")
        .select(
          "id, from_city, to_city, travel_date, travel_time, item_type, status, created_at",
        )
        .eq("traveller_id", userId)
        .eq("status", "active")
        .or(
          `travel_date.gt.${date},and(travel_date.eq.${date},travel_time.gte.${time})`,
        )
        .order("travel_date", { ascending: true })
        .order("travel_time", { ascending: true })
        .order("id", { ascending: true })
        .limit(2),
    ),
    Promise.resolve().then(() =>
      supabase
        .from("requests")
        .select(
          "id, sender_id, journeys!inner(from_city, to_city, travel_date, travel_time)",
        )
        .eq("journeys.traveller_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(2)
        .returns<Omit<HomeRequest, "senderName">[]>(),
    ),
  ]);
  if (journeys.status === "rejected" || journeys.value.error)
    result.journeysError =
      "Your journeys couldn’t load. Open the dashboard to try again.";
  else result.journeys = (journeys.value.data ?? []) as OwnedJourney[];
  if (requests.status === "rejected" || requests.value.error)
    result.requestsError =
      "Pending requests couldn’t load. Check Requests Received in your dashboard.";
  else if (requests.value.data?.length) {
    try {
      const rows = requests.value.data;
      const names = await supabase
        .from("profile_directory")
        .select("id, name")
        .in("id", [...new Set(rows.map((row) => row.sender_id))]);
      if (names.error) throw names.error;
      const directory = new Map(
        (names.data ?? []).map((row) => [row.id, row.name]),
      );
      result.requests = rows.map((row) => ({
        ...row,
        senderName: directory.get(row.sender_id) || "Sender",
      }));
    } catch {
      result.requestsError =
        "Pending request details couldn’t load. Open Requests Received to try again.";
    }
  }
  return result;
}

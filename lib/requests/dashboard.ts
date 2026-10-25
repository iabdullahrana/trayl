import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type JourneyContext = {
  id: string;
  traveller_id: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  travel_time: string;
  status: string;
};
export type RequestRow = {
  id: string;
  journey_id: string;
  sender_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string | null;
};
export type DashboardRequest = RequestRow & {
  journey: JourneyContext;
  otherName: string;
  contact: { phone: string | null; email: string | null } | null;
  contactError?: string;
};

export async function getRequests(
  direction: "received" | "sent",
  page = 1,
): Promise<DashboardRequest[]> {
  if (!getSupabaseConfig()) redirect("/login");
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const journeyColumns =
    "id, traveller_id, from_city, to_city, travel_date, travel_time, status";
  const requestColumns = "id, journey_id, sender_id, status, created_at";
  const offset =
    (Math.max(1, Math.min(100000, Math.floor(page) || 1)) - 1) * 20;
  let query = supabase
    .from("requests")
    .select(`${requestColumns}, journey:journeys!inner(${journeyColumns})`);
  query =
    direction === "received"
      ? query.eq("journey.traveller_id", user.id)
      : query.eq("sender_id", user.id);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 20);
  if (error) throw new Error("Unable to load requests.");
  const joined = (data ?? []) as unknown as (RequestRow & {
    journey: JourneyContext;
  })[];
  const journeys = joined.map((row) => row.journey);
  const requests: RequestRow[] = joined;
  if (!requests.length) return [];
  const journeyMap = new Map(journeys.map((j) => [j.id, j]));
  const otherIds = Array.from(
    new Set(
      requests
        .map((r) =>
          direction === "received"
            ? r.sender_id
            : journeyMap.get(r.journey_id)?.traveller_id,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  );
  // Names only. Contact information is obtained exclusively through the RPC.
  const { data: names, error: namesError } = await supabase
    .from("profile_directory")
    .select("id, name")
    .in("id", otherIds)
    .limit(21);
  if (namesError) throw new Error("Unable to load participant names.");
  const nameMap = new Map((names ?? []).map((p) => [p.id, p.name]));
  return Promise.all(
    requests.map(async (request) => {
      const journey = journeyMap.get(request.journey_id);
      if (!journey)
        throw new Error(
          "Journey details are unavailable. Check that all migrations have been applied.",
        );
      const otherId =
        direction === "received" ? request.sender_id : journey.traveller_id;
      const row: DashboardRequest = {
        ...request,
        journey,
        otherName: nameMap.get(otherId) ?? "Traveller",
        contact: null,
      };
      if (request.status === "accepted") {
        try {
          const { data, error } = await supabase.rpc("contact_reveal", {
            journey_id: request.journey_id,
            other_user_id: otherId,
          });
          if (error || !data?.length)
            row.contactError =
              "Contact details are currently unavailable. Please refresh.";
          else row.contact = data[0];
        } catch {
          row.contactError = "Unable to load contact details. Please refresh.";
        }
      }
      return row;
    }),
  );
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { uuidPattern } from "@/lib/chat/types";

export async function getChatAccess(requestId: string) {
  if (typeof requestId !== "string" || !uuidPattern.test(requestId))
    return null;
  const { user } = await getCurrentUser();
  if (!user) return null;
  const supabase = createClient();
  const { data: request, error } = await supabase
    .from("requests")
    .select("id, sender_id, journey_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error("Unable to check chat access. Please try again.");
  if (!request || request.status !== "accepted") return null;
  const { data: journey, error: journeyError } = await supabase
    .from("journeys")
    .select("traveller_id, from_city, to_city, travel_date, travel_time")
    .eq("id", request.journey_id)
    .maybeSingle();
  if (journeyError) throw new Error("Unable to load journey details.");
  if (
    !journey ||
    (user.id !== request.sender_id && user.id !== journey.traveller_id)
  )
    return null;
  return {
    supabase,
    user,
    journey,
    otherId:
      user.id === request.sender_id ? journey.traveller_id : request.sender_id,
  };
}

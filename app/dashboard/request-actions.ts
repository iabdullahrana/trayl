"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type RequestState = { error?: string; success?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authenticatedClient() {
  if (!getSupabaseConfig()) redirect("/login");
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
}

function refreshRequests() {
  revalidatePath("/dashboard/requests-received");
  revalidatePath("/dashboard/requests-sent");
  revalidatePath("/");
  revalidatePath("/dashboard");
}

export async function sendRequest(journeyId: string): Promise<RequestState> {
  const { supabase, user } = await authenticatedClient();
  if (typeof journeyId !== "string" || !uuid.test(journeyId))
    return { error: "Please select a valid journey." };
  try {
    const { data: journey, error } = await supabase
      .from("journeys")
      .select("traveller_id, travel_date, travel_time, status")
      .eq("id", journeyId)
      .maybeSingle();
    if (
      error ||
      !journey ||
      journey.status !== "active" ||
      Date.parse(`${journey.travel_date}T${journey.travel_time}Z`) < Date.now()
    )
      return { error: "This journey is no longer available." };
    if (journey.traveller_id === user.id)
      return { error: "You cannot request your own journey." };
    const { data: existing, error: lookupError } = await supabase
      .from("requests")
      .select("id")
      .eq("journey_id", journeyId)
      .eq("sender_id", user.id)
      .eq("status", "pending")
      .limit(1);
    if (lookupError)
      return { error: "We couldn't check your requests. Please try again." };
    if (existing?.length)
      return {
        success: "You already have a pending request for this journey.",
      };
    const { error: insertError } = await supabase
      .from("requests")
      .insert({ journey_id: journeyId, sender_id: user.id, status: "pending" });
    if (insertError?.code === "23505")
      return {
        success: "You already have a pending request for this journey.",
      };
    if (insertError)
      return {
        error:
          "We couldn't send your request. Check that your profile is set up and try again.",
      };
  } catch {
    return {
      error:
        "We couldn't confirm your request. Check your sent requests before trying again.",
    };
  }
  refreshRequests();
  return { success: "Request sent." };
}

export async function updateRequestStatus(
  requestId: string,
  status: "accepted" | "declined",
): Promise<RequestState> {
  const { supabase, user } = await authenticatedClient();
  if (
    typeof requestId !== "string" ||
    !uuid.test(requestId) ||
    !["accepted", "declined"].includes(status)
  )
    return { error: "Invalid request or status." };
  try {
    const { data: request, error } = await supabase
      .from("requests")
      .select("journey_id")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !request) return { error: "This request is unavailable." };
    const { data: journey, error: journeyError } = await supabase
      .from("journeys")
      .select("traveller_id")
      .eq("id", request.journey_id)
      .maybeSingle();
    if (journeyError || journey?.traveller_id !== user.id)
      return { error: "Only the traveller can respond to this request." };
    // Prevent stale tabs from overwriting a prior decision.
    const { data, error: updateError } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id");
    if (updateError)
      return { error: "We couldn't update this request. Please try again." };
    if (!data?.length)
      return {
        error:
          "This request has already changed. Refresh to see its current status.",
      };
  } catch {
    return {
      error: "We couldn't confirm the update. Refresh before trying again.",
    };
  }
  refreshRequests();
  return {
    success: status === "accepted" ? "Request accepted." : "Request declined.",
  };
}

export async function respondToRequest(
  _previous: RequestState,
  form: FormData,
): Promise<RequestState> {
  return updateRequestStatus(
    String(form.get("request_id") ?? ""),
    String(form.get("status") ?? "") as "accepted" | "declined",
  );
}

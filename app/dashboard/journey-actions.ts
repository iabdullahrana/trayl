"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type CancelState = { error?: string; success?: string };

export async function cancelJourney(
  _previous: CancelState,
  form: FormData,
): Promise<CancelState> {
  if (!getSupabaseConfig()) redirect("/login");
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const id = form.get("journey_id");
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return { error: "Please select a valid journey." };
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const time = now.slice(11, -1);
  try {
    // Scope the UPDATE itself to the owner and future/active rows, so stale
    // forms cannot cancel someone else's, completed, or departed journeys.
    const { data, error } = await supabase
      .from("journeys")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("traveller_id", user.id)
      .eq("status", "active")
      .or(
        `travel_date.gt.${date},and(travel_date.eq.${date},travel_time.gt.${time})`,
      )
      .select("id");
    if (error)
      return { error: "We couldn't cancel your journey. Please try again." };
    if (!data?.length)
      return {
        error:
          "This journey is no longer cancellable. Refresh to see its current status.",
      };
  } catch {
    return {
      error:
        "We couldn't confirm the cancellation. Refresh before trying again.",
    };
  }
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests-received");
  revalidatePath("/dashboard/requests-sent");
  revalidatePath("/search");
  return { success: "Journey cancelled." };
}

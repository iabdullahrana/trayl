"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { validateJourney, type JourneyState } from "@/lib/journeys/validation";

export async function postJourney(
  _previous: JourneyState,
  form: FormData,
): Promise<JourneyState> {
  const { values, fieldErrors, valid } = validateJourney(form);
  if (!valid) return { fieldErrors };
  if (!getSupabaseConfig())
    return { error: "Journey posting is unavailable. Please try again later." };

  let firstMoment = false;
  let notice: string | undefined;
  try {
    const supabase = createClient();
    // Re-check authentication on every submission; never trust a form user ID.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return {
        error: "Your session has expired. Please log in again before posting.",
      };
    const { error } = await supabase.from("journeys").insert({
      ...values,
      traveller_id: user.id,
      status: "active",
    });
    if (error) {
      if (error.code === "42501")
        return {
          error:
            "You don't have permission to post this journey. Please log in again or contact support.",
        };
      if (error.code === "23503")
        return {
          error:
            "Your account profile is missing. Please contact support before posting a journey.",
        };
      return { error: "We couldn't save your journey. Please try again." };
    }
    // A committed journey stays successful even if the optional milestone claim fails.
    try {
      const claim = await supabase.rpc("claim_first_moment", {
        moment_kind: "first_journey",
      });
      if (claim.error)
        notice = "Journey saved. Your first-post milestone couldn’t sync yet.";
      else firstMoment = claim.data === true;
    } catch {
      notice = "Journey saved. Your first-post milestone couldn’t sync yet.";
    }
  } catch {
    return {
      error:
        "We couldn't confirm whether your journey was saved. Check your journeys before trying again.",
    };
  }
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/search");
  return { success: true, journey: values, firstMoment, notice };
}

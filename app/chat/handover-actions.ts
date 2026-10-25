"use server";
import { getChatAccess } from "@/lib/chat/server";
import type { HandoverResult } from "@/lib/chat/handover";

export async function loadHandover(requestId: string): Promise<HandoverResult> {
  return handover(requestId, false);
}
export async function confirmHandover(
  requestId: string,
): Promise<HandoverResult> {
  return handover(requestId, true);
}
async function handover(
  requestId: string,
  confirm: boolean,
): Promise<HandoverResult> {
  try {
    const access = await getChatAccess(requestId);
    if (!access)
      return { error: "This delivery is not available to your account." };
    const { supabase, user, journey } = access;
    if (confirm) {
      const result = await supabase.rpc("confirm_handover", {
        chat_id: requestId,
      });
      if (result.error)
        return {
          error:
            "We couldn’t confirm this handover. Check that the chat is still available and try again.",
        };
    }
    const { data, error } = await supabase
      .from("handovers")
      .select("sender_confirmed_at, traveller_confirmed_at, completed_at")
      .eq("request_id", requestId)
      .maybeSingle();
    if (error)
      return { error: "Handover status couldn’t load. Please try again." };
    const isTraveller = user.id === journey.traveller_id;
    return {
      handover: {
        mine: Boolean(
          isTraveller
            ? data?.traveller_confirmed_at
            : data?.sender_confirmed_at,
        ),
        theirs: Boolean(
          isTraveller
            ? data?.sender_confirmed_at
            : data?.traveller_confirmed_at,
        ),
        completedAt: data?.completed_at ?? null,
        from: journey.from_city,
        to: journey.to_city,
        date: journey.travel_date,
      },
    };
  } catch {
    return {
      error:
        "We couldn’t check this delivery. Retry to confirm its current status.",
    };
  }
}

// Only invoked when the completed card is open and visible, never by background polls.
export async function claimHandoverMoment(
  requestId: string,
): Promise<{ firstMoment?: boolean; error?: string }> {
  try {
    const access = await getChatAccess(requestId);
    if (!access) return { firstMoment: false };
    const { data, error } = await access.supabase
      .from("handovers")
      .select("completed_at")
      .eq("request_id", requestId)
      .maybeSingle();
    if (error)
      return {
        error: "Your delivery is saved, but the milestone couldn’t sync.",
      };
    if (!data?.completed_at) return { firstMoment: false };
    const claim = await access.supabase.rpc("claim_first_moment", {
      moment_kind: "first_handover",
      moment_source: requestId,
    });
    if (claim.error)
      return {
        error: "Your delivery is saved, but the milestone couldn’t sync.",
      };
    return { firstMoment: claim.data === true };
  } catch {
    return {
      error: "Your delivery is saved, but the milestone couldn’t sync.",
    };
  }
}

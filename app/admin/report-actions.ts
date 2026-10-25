"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/server";
import { uuidPattern } from "@/lib/chat/types";
export type ReportActionState = { error?: string; success?: string };
export async function moderateReport(
  _previous: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const { supabase } = await requireAdmin();
  const id = form.get("reportId"),
    action = form.get("action");
  if (
    typeof id !== "string" ||
    !uuidPattern.test(id) ||
    !["review", "deactivate"].includes(String(action))
  )
    return { error: "Invalid report action." };
  try {
    const { data, error } = await supabase.rpc(
      action === "review"
        ? "admin_review_report"
        : "admin_deactivate_report_user",
      { report_id: id },
    );
    if (error)
      return {
        error:
          "Unable to update this report. You cannot deactivate yourself. Please refresh and retry.",
      };
    if (!data)
      return {
        error:
          "This report or account has already changed. Refresh to see its status.",
      };
    revalidatePath("/", "layout");
    return {
      success: action === "review" ? "Marked reviewed." : "User deactivated.",
    };
  } catch {
    return { error: "Unable to confirm this action. Refresh before retrying." };
  }
}

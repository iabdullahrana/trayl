"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/server";

export type AdminActionState = { error?: string; success?: string };

export async function runAdminAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const { supabase, user } = await requireAdmin();
  const id = form.get("id");
  const action = form.get("action");
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !["deactivate", "cancel"].includes(String(action))
  )
    return { error: "Invalid action." };
  if (action === "deactivate" && id === user.id)
    return { error: "You cannot deactivate your own account." };
  try {
    const { data, error } =
      action === "deactivate"
        ? await supabase.rpc("admin_deactivate_user", { target_user_id: id })
        : await supabase.rpc("admin_force_cancel_journey", {
            target_journey_id: id,
          });
    if (error)
      return {
        error: "The action could not be completed. Refresh and try again.",
      };
    if (!data)
      return {
        error:
          "This row has already changed. Refresh to see its current state.",
      };
  } catch {
    return {
      error:
        "Unable to confirm the change. Please refresh before trying again.",
    };
  }
  revalidatePath("/", "layout");
  return {
    success:
      action === "deactivate" ? "User deactivated." : "Journey cancelled.",
  };
}

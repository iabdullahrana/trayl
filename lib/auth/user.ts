import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type Profile = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_adult_confirmed: boolean;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string | null;
};

// Request-scoped cache; never authorize a user from an unverified getSession().
export const getCurrentUser = cache(async () => {
  if (!getSupabaseConfig()) return { user: null, profile: null };
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, profile: null };
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, name, phone, email, is_adult_confirmed, role, is_active, created_at",
    )
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (error) throw new Error("Unable to load your profile. Please try again.");
  if (!profile?.is_active) return { user: null, profile: null };
  return { user, profile };
});

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current.user) redirect("/login");
  return current;
}

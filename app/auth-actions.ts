"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  authErrorMessage,
  validateAuth,
  type AuthState,
} from "@/lib/auth/validation";

export async function signup(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const { values, fieldErrors, valid } = validateAuth(form, "signup");
  if (!valid) return { fieldErrors };
  if (!getSupabaseConfig())
    return {
      error:
        "Account registration is not configured yet. Please try again later.",
    };

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          name: values.name,
          phone: values.phone || null,
          is_adult_confirmed: true,
        },
      },
    });
    // Migration 0003 inserts the profile in the auth-user transaction.
    // No client INSERT is possible when email confirmation returns no session.
    if (error) return { error: authErrorMessage(error.code) };
    if (data.user?.identities?.length === 0) {
      return { error: authErrorMessage("user_already_exists") };
    }
    if (!data.user)
      return { error: "Your account could not be created. Please try again." };
    if (!data.session) {
      return {
        success:
          "Check your inbox to confirm your email, then return here to log in with your password.",
      };
    }
  } catch {
    return { error: "Unable to reach the sign-up service. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function login(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const { values, fieldErrors, valid } = validateAuth(form, "login");
  if (!valid) return { fieldErrors };
  if (!getSupabaseConfig())
    return { error: "Login is not configured yet. Please try again later." };
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) return { error: authErrorMessage(error.code) };
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile?.is_active) {
      await supabase.auth.signOut({ scope: "local" });
      return {
        error:
          "This account is unavailable or deactivated. Please contact support.",
      };
    }
  } catch {
    return { error: "Unable to reach the login service. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

// Use the same cookie-backed server client as password login.
export async function logout(): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error } = await createClient().auth.signOut({ scope: "local" });
    if (error) return { error: "We couldn't log you out. Please try again." };
  } catch {
    return { error: "Unable to reach the login service. Please try again." };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

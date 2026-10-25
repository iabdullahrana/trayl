"use client";

import { storageFetch } from "@/lib/supabase/upload-client";
import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createBrowserClient(url, anonKey, { global: { fetch: storageFetch } });
}

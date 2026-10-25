export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return url && anonKey ? { url, anonKey } : null;
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Set the Supabase URL and anon key in .env.local first.");
  }
  return config;
}

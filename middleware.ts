import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  const isAdmin =
    request.nextUrl.pathname === "/admin" ||
    request.nextUrl.pathname.startsWith("/admin/");
  const isPublic = [
    "/",
    "/login",
    "/signup",
    "/search",
    "/api/journeys/search",
  ].includes(request.nextUrl.pathname);
  const loginRedirect = (pathname = "/login") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };
  if (!config)
    return isPublic ? response : loginRedirect(isAdmin ? "/" : "/login");

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Validate the user and persist refreshed session cookies before rendering.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return isPublic ? response : loginRedirect(isAdmin ? "/" : "/login");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return isPublic ? response : loginRedirect(isAdmin ? "/" : "/login");
  }
  if (isAdmin && profile.role !== "admin") return loginRedirect("/");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico$).*)"],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/status", "/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = request.nextUrl.pathname;

  // Frontend Spec §5: /status is genuinely public, no auth check at all.
  if (PUBLIC_ROUTES.some((route) => path.startsWith(route))) {
    return response;
  }

  if (!session) {
    // Temporary bypass: disable server-side redirect to login
    // return NextResponse.redirect(new URL("/login", request.url));
  }

  // /access requires operator role
  if (path.startsWith("/access")) {
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("user_id", session.user.id).single();
      if (profile?.role !== "operator") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

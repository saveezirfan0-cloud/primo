import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidSession } from "@/lib/auth";

/**
 * Demo password gate. Every page except /login requires a valid session
 * cookie when DEMO_PASSWORD is set. Static assets are excluded by the matcher.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = await isValidSession(request.cookies.get(AUTH_COOKIE)?.value);

  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!authed) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

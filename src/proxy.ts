import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_PATHS = ["/login", "/register"];
const ONBOARDING_PATHS = ["/create", "/join"];
const PUBLIC_PATHS = [...AUTH_PATHS, ...ONBOARDING_PATHS];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  const isAuthed = Boolean(sessionCookie);
  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isOnboarding = ONBOARDING_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isAuthed && !PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthed && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  // 配对门禁细查在布局/页面里做（需要查库）；proxy 只做登录态粗拦
  if (isAuthed && isOnboarding) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

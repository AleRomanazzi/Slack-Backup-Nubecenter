import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiAuthRoute = pathname.startsWith("/api/auth/");
  const isLoginPage = pathname === "/login";
  const isStaticAsset = pathname.startsWith("/_next/") || pathname.startsWith("/favicon.ico");
  const isPublicFile = /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isApiAuthRoute || isStaticAsset || isPublicFile) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionToken && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

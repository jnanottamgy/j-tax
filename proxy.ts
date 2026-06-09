import { type NextRequest, NextResponse } from "next/server"

import { canAccessRoute, parseAppRole } from "@/lib/auth/roles"
import { updateSession } from "@/lib/supabase/middleware"

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/auth/reset-password",
  "/api/cron/payments",
  "/unauthorized",
]
const AUTH_ROUTES = ["/login", "/signup"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const { supabaseResponse, user } = await updateSession(request)

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (!user) {
    if (isPublicRoute) return supabaseResponse
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    if (pathname !== "/") loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role =
    parseAppRole(user.app_metadata?.role) ??
    parseAppRole(user.user_metadata?.role)

  if (!role) {
    if (pathname === "/unauthorized") return supabaseResponse
    const unauthorizedUrl = request.nextUrl.clone()
    unauthorizedUrl.pathname = "/unauthorized"
    unauthorizedUrl.searchParams.set("reason", "missing_role")
    return NextResponse.redirect(unauthorizedUrl)
  }

  if (isAuthRoute) {
    const raw = request.nextUrl.searchParams.get("redirectTo") || "/"
    // LOW-01: only allow same-origin relative paths — reject //evil.com etc.
    const isSafe =
      raw.startsWith("/") && !raw.startsWith("//") && !raw.includes(":")
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = isSafe ? raw : "/"
    homeUrl.search = ""
    return NextResponse.redirect(homeUrl)
  }

  if (pathname === "/unauthorized") {
    return supabaseResponse
  }

  if (!canAccessRoute(role, pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const unauthorizedUrl = request.nextUrl.clone()
    unauthorizedUrl.pathname = "/unauthorized"
    unauthorizedUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(unauthorizedUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

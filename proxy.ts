import { type NextRequest, NextResponse } from "next/server"

import { canAccessRoute, parseAppRole } from "@/lib/auth/roles"
import { updateSession } from "@/lib/supabase/middleware"

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/auth/reset-password",
  // Cron routes authenticate themselves via CRON_SECRET (Bearer header) —
  // they arrive without a Supabase session, so they must bypass the proxy.
  "/api/cron/payments",
  "/api/cron/quotation-followups",
  "/api/cron/reminders",
  "/api/cron/compliance-recurring",
  "/api/cron/task-automation",
  // Meta calls this without a session; the route verifies the webhook token
  // (GET handshake) and X-Hub-Signature-256 (POST) itself.
  "/api/webhooks/whatsapp",
  "/unauthorized",
  "/q",
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

  // Provisioned staff signing in with a temporary password must choose their
  // own before touching anything else in the app.
  if (
    user.user_metadata?.must_change_password &&
    pathname !== "/auth/set-password" &&
    !pathname.startsWith("/api/")
  ) {
    const setPasswordUrl = request.nextUrl.clone()
    setPasswordUrl.pathname = "/auth/set-password"
    setPasswordUrl.search = ""
    return NextResponse.redirect(setPasswordUrl)
  }

  if (isAuthRoute) {
    const raw = request.nextUrl.searchParams.get("redirectTo") || "/"
    // LOW-01: only allow same-origin relative paths — reject //evil.com etc.
    const isSafe =
      raw.startsWith("/") && !raw.startsWith("//") && !raw.includes(":")
    const homeUrl = request.nextUrl.clone()
    // CLIENT role users must land on the client portal, never the staff app
    homeUrl.pathname = role === "CLIENT" ? "/client" : (isSafe ? raw : "/")
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
    // CLIENT users hitting staff routes go to their portal, not the error page
    if (role === "CLIENT") {
      const clientUrl = request.nextUrl.clone()
      clientUrl.pathname = "/client"
      clientUrl.search = ""
      return NextResponse.redirect(clientUrl)
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

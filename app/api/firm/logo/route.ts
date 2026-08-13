import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import { getFirmLogo } from "@/lib/firm-settings"

/**
 * The signed-in user's own firm logo.
 *
 * Serving the bytes from a route rather than inlining a data URL keeps a few
 * hundred KB of base64 out of every page payload, and lets the browser cache
 * it. There is no id in the path on purpose — the firm is taken from the
 * session, so this cannot be walked to another tenant's letterhead.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const logo = await getFirmLogo()
  if (!logo) return new NextResponse("Not found", { status: 404 })

  return new NextResponse(logo.data as unknown as BodyInit, {
    headers: {
      "Content-Type": logo.mimeType,
      "Content-Length": String(logo.data.length),
      // Per-user and revalidated by the ?v=<logoUpdatedAt> the callers append,
      // so it must never land in a shared cache.
      "Cache-Control": "private, max-age=300",
    },
  })
}

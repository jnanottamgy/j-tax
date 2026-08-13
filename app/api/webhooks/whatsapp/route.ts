/**
 * WhatsApp Cloud API webhook (Meta)
 *
 * GET  — one-time verification handshake when you register the webhook URL in
 *        Meta App Dashboard → WhatsApp → Configuration. Meta sends
 *        hub.mode/hub.verify_token/hub.challenge; we echo the challenge when
 *        the token matches WHATSAPP_WEBHOOK_VERIFY_TOKEN.
 *
 * POST — delivery-status updates (sent → delivered → read / failed) and
 *        inbound messages. Statuses are matched to Message rows via the
 *        provider message id (wamid) we stored in metadata.externalId.
 *
 * Security: when WHATSAPP_APP_SECRET is set, the X-Hub-Signature-256 header
 * (HMAC-SHA256 of the raw body) is verified before processing. Always respond
 * 200 quickly — Meta retries aggressively on non-2xx.
 */

import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { MessageStatus } from "@prisma/client"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!expected) {
    return new NextResponse("WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured", {
      status: 503,
    })
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  // Signature verification is opt-in: without the app secret we accept the
  // payload (matches how the rest of the app degrades when unconfigured).
  if (!secret) return true
  if (!header?.startsWith("sha256=")) return false

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  const provided = header.slice("sha256=".length)
  if (expected.length !== provided.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"))
  } catch {
    return false
  }
}

/** Meta status → our MessageStatus enum. */
const STATUS_MAP: Record<string, MessageStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 })
  }

  try {
    const changes =
      payload?.entry?.flatMap((e: any) => e?.changes ?? []) ?? []

    for (const change of changes) {
      const value = change?.value
      if (!value) continue

      // ── Delivery-status updates ────────────────────────────────────────────
      for (const status of value.statuses ?? []) {
        const wamid: string | undefined = status?.id
        const mapped = STATUS_MAP[status?.status as string]
        if (!wamid || !mapped) continue

        const message = await prisma.message.findFirst({
          where: { metadata: { path: ["externalId"], equals: wamid } },
          select: { id: true, status: true },
        })
        if (!message) continue

        // Never regress READ → DELIVERED → SENT (webhooks can arrive out of order)
        const rank: Record<string, number> = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 }
        if ((rank[mapped] ?? 0) <= (rank[message.status] ?? 0) && mapped !== "FAILED") {
          continue
        }

        const timestamps: Record<MessageStatus, object> = {
          SENT: { sentAt: new Date() },
          DELIVERED: { deliveredAt: new Date() },
          READ: { readAt: new Date() },
          FAILED: {
            failedAt: new Date(),
            errorMessage:
              status?.errors?.[0]?.message ??
              status?.errors?.[0]?.title ??
              "Delivery failed",
          },
          PENDING: {},
          QUEUED: {},
          RETRYING: {},
        }

        await prisma.message.update({
          where: { id: message.id },
          data: { status: mapped, ...timestamps[mapped] },
        })
        await prisma.messageLog.create({
          data: {
            messageId: message.id,
            status: mapped,
            details: {
              source: "whatsapp_webhook",
              wamid,
              ...(status?.errors ? { errors: status.errors } : {}),
            },
          },
        })
      }

      // ── Inbound client replies ─────────────────────────────────────────────
      // v1: log them against the client (matched by phone) so the team sees a
      // notification; a full two-way inbox is a future feature.
      for (const inbound of value.messages ?? []) {
        const from: string | undefined = inbound?.from // E.164 digits
        const text: string | undefined = inbound?.text?.body
        if (!from) continue

        const last10 = from.slice(-10)

        // A webhook carries no session, so nothing here is auto firm-scoped.
        // The sender's number is the only thing that identifies the firm, and
        // two firms can legitimately hold the same contact — so resolve ALL
        // matches and notify each firm about its own client only. Taking the
        // first match and notifying every Partner on the platform (the previous
        // behaviour) leaked client names and message text across tenants.
        const clients = await prisma.client.findMany({
          where: {
            deletedAt: null,
            OR: [
              { whatsapp: { contains: last10 } },
              { phone: { contains: last10 } },
            ],
          },
          select: { id: true, name: true, firmId: true },
        })
        if (clients.length === 0) continue

        for (const client of clients) {
          const staff = await prisma.user.findMany({
            where: { role: { in: ["PARTNER", "MANAGER"] }, firmId: client.firmId },
            select: { id: true },
          })
          if (staff.length === 0) continue

          await prisma.notification.createMany({
            data: staff.map((u) => ({
              userId: u.id,
              title: `WhatsApp reply from ${client.name}`,
              message: text
                ? text.slice(0, 500)
                : "New WhatsApp message (non-text) received.",
              type: "INFO" as const,
              entityType: "CLIENT" as const,
              entityId: client.id,
            })),
          })
        }
      }
    }
  } catch (err) {
    // Log and still 200 — Meta retries on failure and the payload will not
    // parse differently next time.
    console.error("WhatsApp webhook processing error:", err)
  }

  return NextResponse.json({ received: true })
}

import { cache } from "react"

import { prisma } from "@/lib/prisma"
import type { SessionInfo } from "@/lib/auth/types"

/**
 * Which client record is this portal visitor?
 *
 * Resolution was previously an email string match, repeated in six places. That
 * had three problems: access could not be granted from the app at all (nothing
 * wrote the relationship), it broke the moment a client changed their address,
 * and two client records sharing an email made the answer ambiguous.
 *
 * `Client.portalUserId` is now the answer — an explicit, revocable link written
 * when a Partner invites the client. Email remains a fallback so firms that
 * hand-provisioned a CLIENT login before this existed keep working, and the
 * first visit through that path upgrades the record to the real link.
 *
 * Memoised per request: the layout and the page both call it, and they must
 * agree on the answer.
 */

export type PortalClient = {
  id: string
  name: string
  email: string | null
  phone: string | null
  pan: string | null
  gstin: string | null
  status: string
}

export type PortalResolution =
  | { ok: true; client: PortalClient }
  | { ok: false; reason: "none" | "ambiguous" }

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  pan: true,
  gstin: true,
  status: true,
} as const

export const resolvePortalClient = cache(
  async (session: SessionInfo): Promise<PortalResolution> => {
    // 1. The explicit grant.
    const linked = await prisma.client.findFirst({
      where: { portalUserId: session.user.id, deletedAt: null },
      select: SELECT,
    })
    if (linked) {
      void touchLastSeen(linked.id)
      return { ok: true, client: linked }
    }

    // 2. Legacy: a CLIENT login created by hand before portal invites existed.
    //    Client.email is not unique, so two records sharing an address must
    //    refuse rather than silently bind to whichever row came back first.
    if (!session.user.email) return { ok: false, reason: "none" }

    const matches = await prisma.client.findMany({
      where: { email: session.user.email, deletedAt: null },
      select: SELECT,
      take: 2,
    })

    if (matches.length === 0) return { ok: false, reason: "none" }
    if (matches.length > 1) return { ok: false, reason: "ambiguous" }

    // Upgrade the legacy match to a real link so the next visit takes path 1
    // and the client record shows portal access as granted.
    const client = matches[0]
    void adoptLegacyLink(client.id, session.user.id)
    return { ok: true, client }
  }
)

/** Best-effort — a failed write must never cost the client their portal. */
async function touchLastSeen(clientId: string): Promise<void> {
  try {
    await prisma.client.update({
      where: { id: clientId },
      data: { portalLastSeenAt: new Date() },
    })
  } catch {
    /* ignore */
  }
}

async function adoptLegacyLink(clientId: string, userId: string): Promise<void> {
  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        portalUserId: userId,
        portalInvitedAt: new Date(),
        portalLastSeenAt: new Date(),
      },
    })
  } catch {
    // A unique-constraint clash means this auth user is already linked to a
    // different client. Leaving the legacy email path in place is the safe
    // outcome — the visitor still sees the record their address matches.
  }
}

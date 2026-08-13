"use server"

import { revalidatePath } from "next/cache"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById } from "@/lib/auth/scope"
import { getSession } from "@/lib/auth/session"
import {
  provisionClientPortalAccount,
  setStaffLoginBanned,
} from "@/lib/auth/provisioning"
import { getFirmSettings } from "@/lib/firm-settings"
import { prisma } from "@/lib/prisma"
import { recordTimelineEvent } from "@/lib/timeline/events"

/**
 * Client portal access — grant, revoke, restore.
 *
 * The portal existed as six finished pages with no way in: it resolved the
 * viewer by matching their session email against the client's email address,
 * which meant access could only be granted by hand-creating a Supabase user
 * outside the product. This is the missing half.
 */

export type PortalAccessState = {
  enabled: boolean
  email: string | null
  invitedAt: string | null
  lastSeenAt: string | null
  /** Set only on the response to a fresh invite, never on read. */
  tempPassword?: string | null
  emailSent?: boolean
  emailError?: string
}

export async function getClientPortalAccess(
  clientId: string
): Promise<PortalAccessState | null> {
  const session = await getSession()
  if (!session) return null
  if (!(await canAccessClientById(session, clientId))) return null

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      email: true,
      portalUserId: true,
      portalInvitedAt: true,
      portalLastSeenAt: true,
    },
  })
  if (!client) return null

  return {
    enabled: Boolean(client.portalUserId),
    email: client.email,
    invitedAt: client.portalInvitedAt?.toISOString() ?? null,
    lastSeenAt: client.portalLastSeenAt?.toISOString() ?? null,
  }
}

export async function inviteClientToPortal(
  clientId: string
): Promise<{ success: boolean; error?: string; state?: PortalAccessState }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to grant portal access." }
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, email: true, portalUserId: true },
  })
  if (!client) return { success: false, error: "Client not found." }

  if (!client.email?.trim()) {
    return {
      success: false,
      error: "This client has no email address. Add one before inviting them to the portal.",
    }
  }

  const cfg = await getFirmSettings()
  const provisioned = await provisionClientPortalAccount({
    clientName: client.name,
    email: client.email.trim(),
    firmName: cfg.firmName,
  })

  if (!provisioned.ok) {
    return { success: false, error: provisioned.error }
  }

  const invitedAt = new Date()
  await prisma.client.update({
    where: { id: clientId },
    data: { portalUserId: provisioned.userId, portalInvitedAt: invitedAt },
  })

  // A previously revoked client is re-enabled by the same action, so lift any
  // ban left over from the revoke — otherwise the invite email arrives with
  // credentials that are refused at the login screen.
  await setStaffLoginBanned(provisioned.userId, false)

  await recordTimelineEvent({
    clientId,
    eventType: "PORTAL_ACCESS_GRANTED",
    title: "Client portal access granted",
    description: `Invite sent to ${client.email}`,
    performedBy: session.user.id,
  }).catch(() => { /* the access itself is what matters */ })

  revalidatePath(`/clients/${clientId}`)

  return {
    success: true,
    state: {
      enabled: true,
      email: client.email,
      invitedAt: invitedAt.toISOString(),
      lastSeenAt: null,
      tempPassword: provisioned.tempPassword,
      emailSent: provisioned.emailSent,
      ...(provisioned.emailError ? { emailError: provisioned.emailError } : {}),
    },
  }
}

export async function revokeClientPortalAccess(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to change portal access." }
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, portalUserId: true },
  })
  if (!client?.portalUserId) return { success: true }

  // Ban the login first. Clearing the link alone would leave a working account
  // that could still sign in — it would simply land on "no client record",
  // which is a dead end rather than a revocation.
  await setStaffLoginBanned(client.portalUserId, true)

  await prisma.client.update({
    where: { id: clientId },
    data: { portalUserId: null, portalInvitedAt: null },
  })

  await recordTimelineEvent({
    clientId,
    eventType: "PORTAL_ACCESS_REVOKED",
    title: "Client portal access revoked",
    description: `${session.user.name} removed portal access`,
    performedBy: session.user.id,
  }).catch(() => { /* revocation already applied */ })

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

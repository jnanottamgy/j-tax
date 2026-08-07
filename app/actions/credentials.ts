"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requirePartner, requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById, clientFirmFilter } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity/logger"
import { toUserError } from "@/lib/forms/errors"
import { openSecret, sealSecret, VAULT_KEY_ERROR } from "@/lib/security/vault-crypto"
import { CREDENTIAL_PORTALS } from "@/lib/registers/constants"

/**
 * Client credential vault actions.
 *
 * Security model:
 * - EVERY read of the vault (list, reveal, trail) and every mutation is
 *   Partner/Manager only — EMPLOYEES never see credentials, not even the list.
 * - Passwords leave the database exactly once per explicit reveal; the list
 *   endpoint never selects passwordEnc.
 * - Every reveal/create/update/delete writes a CredentialAccessLog row, and
 *   mutations additionally write a durable ActivityLog entry (access-log rows
 *   cascade away when a credential is deleted; ActivityLog survives).
 */

export type CredentialRow = {
  id: string
  portal: string
  username: string
  loginUrl: string | null
  notes: string | null
  updatedAt: Date
}

export type CredentialActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

const upsertCredentialSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  id: z.string().optional(),
  portal: z.enum(CREDENTIAL_PORTALS),
  username: z.string().trim().min(1, "Username is required").max(200),
  // Only sent when setting/changing — empty string means "keep current".
  password: z.string().max(500).optional(),
  loginUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\//i.test(v), "Login URL must start with http(s)://")
    .optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type UpsertCredentialInput = z.infer<typeof upsertCredentialSchema>

// ─── Read (list — passwords never included) ─────────────────────────────────

export async function listClientCredentials(
  clientId: string
): Promise<{ credentials?: CredentialRow[]; error?: string }> {
  try {
    const session = await requirePartnerOrManager()

    const credentials = await prisma.clientCredential.findMany({
      where: { clientId, ...clientFirmFilter(session) },
      select: {
        id: true,
        portal: true,
        username: true,
        loginUrl: true,
        notes: true,
        updatedAt: true,
      },
      orderBy: [{ portal: "asc" }, { username: "asc" }],
    })

    return { credentials }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── Reveal (decrypt + audit) ────────────────────────────────────────────────

export async function revealCredentialPassword(
  credentialId: string
): Promise<{ password?: string; error?: string }> {
  try {
    const session = await requirePartnerOrManager()

    const credential = await prisma.clientCredential.findFirst({
      where: { id: credentialId, ...clientFirmFilter(session) },
      select: { id: true, clientId: true, portal: true, username: true, passwordEnc: true },
    })
    if (!credential) return { error: "Credential not found." }

    const password = openSecret(credential.passwordEnc)

    // Audit BOTH ways: the per-credential access log (drives the Partner-only
    // trail) and the durable firm-wide activity log.
    await prisma.credentialAccessLog.create({
      data: { credentialId, userId: session.user.id, action: "VIEWED" },
    })
    await logActivity({
      entityType: "CREDENTIAL",
      entityId: credentialId,
      action: "VIEWED",
      description: `${credential.portal} credential for username "${credential.username}" was revealed`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId: credential.clientId, portal: credential.portal },
    })

    return { password }
  } catch (error) {
    // Surface the vault-key setup problem verbatim so the UI can render a
    // setup notice instead of a generic failure.
    if (error instanceof Error && error.message === VAULT_KEY_ERROR) {
      return { error: VAULT_KEY_ERROR }
    }
    return { error: toUserError(error) }
  }
}

// ─── Create / Update ─────────────────────────────────────────────────────────

export async function upsertCredential(
  input: UpsertCredentialInput
): Promise<CredentialActionState> {
  try {
    const session = await requirePartnerOrManager()

    const parsed = upsertCredentialSchema.safeParse(input)
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    const { clientId, id, portal, username, password, loginUrl, notes } = parsed.data

    // The client is caller-supplied — confirm it belongs to this firm before
    // reading or writing any credential hanging off it (covers the create path).
    if (!(await canAccessClientById(session, clientId))) {
      return { error: "Client not found." }
    }

    if (id) {
      const existing = await prisma.clientCredential.findFirst({
        where: { id, ...clientFirmFilter(session) },
        select: { id: true, clientId: true },
      })
      if (!existing || existing.clientId !== clientId) {
        return { error: "Credential not found." }
      }

      await prisma.clientCredential.update({
        where: { id },
        data: {
          portal,
          username,
          loginUrl: loginUrl || null,
          notes: notes || null,
          updatedBy: session.user.id,
          // Seal a new password only when one was provided — blank keeps current.
          ...(password ? { passwordEnc: sealSecret(password) } : {}),
        },
      })

      await prisma.credentialAccessLog.create({
        data: { credentialId: id, userId: session.user.id, action: "UPDATED" },
      })
      await logActivity({
        entityType: "CREDENTIAL",
        entityId: id,
        action: "UPDATED",
        description: `${portal} credential for username "${username}" was updated${password ? " (password changed)" : ""}`,
        userId: session.user.id,
        userName: session.user.name,
        metadata: { clientId, portal },
      })
    } else {
      if (!password) {
        return { fieldErrors: { password: ["Password is required for a new credential"] } }
      }

      const created = await prisma.clientCredential.create({
        data: {
          clientId,
          portal,
          username,
          passwordEnc: sealSecret(password),
          loginUrl: loginUrl || null,
          notes: notes || null,
          updatedBy: session.user.id,
        },
      })

      await prisma.credentialAccessLog.create({
        data: { credentialId: created.id, userId: session.user.id, action: "CREATED" },
      })
      await logActivity({
        entityType: "CREDENTIAL",
        entityId: created.id,
        action: "CREATED",
        description: `${portal} credential for username "${username}" was added to the vault`,
        userId: session.user.id,
        userName: session.user.name,
        metadata: { clientId, portal },
      })
    }

    revalidatePath(`/clients/${clientId}`)
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === VAULT_KEY_ERROR) return { error: VAULT_KEY_ERROR }
      if (error.message.includes("Unique constraint") || error.message.includes("unique constraint")) {
        return { error: "A credential for this portal and username already exists for this client." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to save credential. Please try again." }
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteCredential(id: string): Promise<CredentialActionState> {
  try {
    const session = await requirePartnerOrManager()

    const credential = await prisma.clientCredential.findFirst({
      where: { id, ...clientFirmFilter(session) },
      select: { id: true, clientId: true, portal: true, username: true },
    })
    if (!credential) return { error: "Credential not found." }

    // The access-log row cascades away with the credential, so the durable
    // ActivityLog entry below is what preserves the deletion trail.
    await prisma.credentialAccessLog.create({
      data: { credentialId: id, userId: session.user.id, action: "DELETED" },
    })
    await logActivity({
      entityType: "CREDENTIAL",
      entityId: id,
      action: "DELETED",
      description: `${credential.portal} credential for username "${credential.username}" was deleted from the vault`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId: credential.clientId, portal: credential.portal },
    })

    await prisma.clientCredential.delete({ where: { id } })

    revalidatePath(`/clients/${credential.clientId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── Access trail (Partner only) ─────────────────────────────────────────────

export type CredentialAccessTrailRow = {
  id: string
  action: string
  createdAt: Date
  userId: string
  userEmail: string | null
  userName: string | null
}

export async function getCredentialAccessTrail(
  credentialId: string
): Promise<{ trail?: CredentialAccessTrailRow[]; error?: string }> {
  try {
    const session = await requirePartner()

    // Nested one level deeper than the other queries: the log's firm boundary
    // runs through its credential's client.
    const logs = await prisma.credentialAccessLog.findMany({
      where: { credentialId, credential: clientFirmFilter(session) },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    // CredentialAccessLog.userId has no FK relation to User, so resolve
    // emails with a second lookup keyed by the distinct user ids.
    const userIds = Array.from(new Set(logs.map((l) => l.userId)))
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        })
      : []
    const byId = new Map(users.map((u) => [u.id, u]))

    return {
      trail: logs.map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        userId: log.userId,
        userEmail: byId.get(log.userId)?.email ?? null,
        userName: byId.get(log.userId)?.name ?? null,
      })),
    }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

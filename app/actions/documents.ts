"use server"

import { revalidatePath } from "next/cache"
import { toUserError } from "@/lib/forms/errors"
import { z } from "zod"

import {
  requireAuth,
  requirePartnerOrManager,
} from "@/lib/auth/guards"
import {
  canAccessAssignedClient,
  getExecutiveEmployeeId,
  isEmployee as isEmployeeRole,
} from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { recordTimelineEvent } from "@/lib/timeline/events"
import {
  assertDocumentBucketExists,
  createSignedUploadUrl,
  deleteFile,
  fileExists,
  getSignedUrl,
  moveFile,
  uploadFile,
} from "@/lib/storage/storage"

export type DocumentActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

const documentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.enum(["GST", "TDS", "ROC", "AUDIT", "INCOME_TAX", "PAYROLL", "BANK_STATEMENTS", "INVOICES", "AGREEMENTS", "OTHER"]),
  clientId: z.string().min(1, "Client is required"),
  description: z.string().optional(),
  isConfidential: z.boolean().default(false),
  expiryDate: z.string().optional(),
  renewalDate: z.string().optional(),
})

/**
 * Production-hardened upload policy:
 * - Allow only PDF, images, DOCX, XLSX
 * - Disallow legacy Office formats and archives (higher malware risk)
 * - Validate extension + MIME + basic file signature ("magic bytes")
 * - Block macro-enabled Office payloads via vbaProject marker
 */
const MAX_FILE_SIZE =
  Number(process.env.DOCUMENT_MAX_FILE_SIZE_MB ?? "25") * 1024 * 1024 // default 25 MB

const ALLOWED_UPLOADS = {
  "application/pdf": { exts: ["pdf"] as const },
  "image/jpeg": { exts: ["jpg", "jpeg"] as const },
  "image/png": { exts: ["png"] as const },
  "image/gif": { exts: ["gif"] as const },
  "image/webp": { exts: ["webp"] as const },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    exts: ["docx"] as const,
    zipLike: true,
    macroMarker: "vbaProject.bin",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    exts: ["xlsx"] as const,
    zipLike: true,
    macroMarker: "vbaProject.bin",
  },
} as const

type AllowedMimeType = keyof typeof ALLOWED_UPLOADS

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".")
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ""
}

function sanitizeFileName(name: string): string {
  // Remove any path separators and control characters
  const base = name
    .replace(/[\\\/]/g, "_")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()

  // Replace remaining unsafe characters
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_")

  // Cap length to keep storage paths reasonable
  const MAX_LEN = 120
  if (safe.length <= MAX_LEN) return safe

  const ext = getFileExtension(safe)
  const stem = safe.slice(0, MAX_LEN - (ext ? ext.length + 1 : 0))
  return ext ? `${stem}.${ext}` : stem
}

function includesBytes(haystack: Uint8Array, needleAscii: string): boolean {
  // Simple ASCII substring scan; sufficient for detecting macro marker in OOXML zip contents.
  const needle = new TextEncoder().encode(needleAscii)
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

async function validateUploadFile(file: File): Promise<string | null> {
  if (!file || file.size === 0) return "File is required"
  if (file.size > MAX_FILE_SIZE) {
    const mb = Math.round((MAX_FILE_SIZE / (1024 * 1024)) * 10) / 10
    return `File size exceeds the ${mb} MB limit.`
  }

  const mime = file.type as AllowedMimeType
  const rule = (ALLOWED_UPLOADS as Record<string, any>)[mime]
  if (!rule) {
    return "File type not allowed. Please upload a PDF, image, Word (.docx), or Excel (.xlsx) file."
  }

  const ext = getFileExtension(file.name)
  if (!rule.exts.includes(ext)) {
    return `File extension ".${ext || "unknown"}" does not match the detected file type.`
  }

  // Basic signature checks
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())

  // PDF: %PDF-
  if (mime === "application/pdf") {
    const s = new TextDecoder().decode(head)
    if (!s.startsWith("%PDF-")) return "Invalid PDF file (missing %PDF header)."
  }

  // ZIP-like (OOXML): "PK"
  if (rule.zipLike) {
    if (!(head[0] === 0x50 && head[1] === 0x4b)) {
      return "Invalid Office file (expected a .docx/.xlsx zip container)."
    }

    // Macro restriction: scan first 2MB for vbaProject.bin marker
    const scanLimit = Math.min(file.size, 2 * 1024 * 1024)
    const scanBuf = new Uint8Array(await file.slice(0, scanLimit).arrayBuffer())
    if (rule.macroMarker && includesBytes(scanBuf, rule.macroMarker)) {
      return "Macro-enabled Office files are not allowed (vbaProject.bin detected). Please upload a clean .docx/.xlsx."
    }
  }

  // PNG signature
  if (mime === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    for (let i = 0; i < sig.length; i++) if (head[i] !== sig[i]) return "Invalid PNG file."
  }

  // JPEG: FF D8 FF
  if (mime === "image/jpeg") {
    if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) {
      return "Invalid JPEG file."
    }
  }

  // GIF: GIF87a or GIF89a
  if (mime === "image/gif") {
    const s = new TextDecoder().decode(head.slice(0, 6))
    if (!(s === "GIF87a" || s === "GIF89a")) return "Invalid GIF file."
  }

  // WEBP: RIFF....WEBP
  if (mime === "image/webp") {
    const s1 = new TextDecoder().decode(head.slice(0, 4))
    const s2 = new TextDecoder().decode(head.slice(8, 12))
    if (!(s1 === "RIFF" && s2 === "WEBP")) return "Invalid WEBP file."
  }

  return null
}

async function assertClientDocumentAccess(
  session: Awaited<ReturnType<typeof requireAuth>>,
  clientId: string,
  message = "You do not have permission to access documents for this client."
): Promise<string | null> {
  const executiveEmployeeId = await getExecutiveEmployeeId(session)
  if (!isEmployeeRole(session.user.role)) return null

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { assignedEmployeeId: true },
  })
  if (!client) return "Client not found."
  if (!canAccessAssignedClient(session, executiveEmployeeId, client.assignedEmployeeId)) {
    return message
  }
  return null
}

export async function getDocuments(filters?: {
  clientId?: string
  category?: string
  search?: string
}) {
  const session = await requireAuth()
  const executiveEmployeeId = await getExecutiveEmployeeId(session)

  const where: any = {}
  
  if (filters?.clientId) {
    where.clientId = filters.clientId
  }
  
  if (filters?.category) {
    where.category = filters.category
  }
  
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { fileName: { contains: filters.search, mode: "insensitive" } },
    ]
  }
  
  if (executiveEmployeeId) {
    where.client = { assignedEmployeeId: executiveEmployeeId }
  } else if (session.user.role === "EMPLOYEE") {
    return { documents: [], clients: [], user: session.user }
  }
  
  const documents = await prisma.document.findMany({
    where,
    include: {
      client: true,
      tags: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
      _count: {
        select: {
          versions: true,
          activities: true,
        },
      },
    },
    orderBy: [
      { createdAt: "desc" },
      { title: "asc" },
    ],
  })
  
  const clients = await prisma.client.findMany({
    where: executiveEmployeeId ? { assignedEmployeeId: executiveEmployeeId } : undefined,
    orderBy: { name: "asc" },
  })
  
  return { documents, clients, user: session.user }
}

export async function uploadDocument(
  _prevState: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  try {
    const session = await requireAuth()
    const executiveEmployeeId = await getExecutiveEmployeeId(session)

    const file = formData.get("file") as File
    if (!file || file.size === 0) {
      return { error: "File is required" }
    }

    const bucketCheck = await assertDocumentBucketExists()
    if (bucketCheck.error) return { error: bucketCheck.error }

    const fileError = await validateUploadFile(file)
    if (fileError) return { error: fileError }

    const raw = {
      title: formData.get("title"),
      category: formData.get("category") || "OTHER",
      clientId: formData.get("clientId"),
      description: formData.get("description") || undefined,
      isConfidential: formData.get("isConfidential") === "true",
      expiryDate: formData.get("expiryDate") || undefined,
      renewalDate: formData.get("renewalDate") || undefined,
    }

    const parsed = documentSchema.safeParse(raw)

    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
    })
    if (!client) {
      return { error: "Client not found." }
    }
    if (
      !canAccessAssignedClient(session, executiveEmployeeId, client.assignedEmployeeId)
    ) {
      return { error: "You can only upload documents for clients assigned to you" }
    }

    // Generate a safe, collision-resistant storage path
    const safeFileName = sanitizeFileName(file.name)
    const objectId = crypto.randomUUID()
    const storagePath = `documents/${parsed.data.clientId}/${objectId}-${safeFileName}`

    // C-03 fix: actually upload the file to Supabase Storage
    const uploadResult = await uploadFile(file, storagePath)
    if (uploadResult.error) {
      return { error: `Storage upload failed: ${uploadResult.error}` }
    }

    const { expiryDate, renewalDate, ...docFields } = parsed.data
    const document = await prisma.document.create({
      data: {
        ...docFields,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
        uploadedBy: session.user.id,
        version: 1,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        renewalDate: renewalDate ? new Date(renewalDate) : null,
      },
    })

    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 1,
        fileName: file.name,
        fileSize: file.size,
        storagePath,
        uploadedBy: session.user.id,
      },
    })

    await prisma.documentActivity.create({
      data: {
        documentId: document.id,
        userId: session.user.id,
        activityType: "UPLOADED",
        metadata: {
          fileName: file.name,
          fileSize: file.size,
        },
      },
    })

    // Timeline event
    await recordTimelineEvent({
      clientId: docFields.clientId,
      eventType: "DOCUMENT_UPLOADED",
      title: `Document uploaded: ${docFields.title}`,
      description: `Category: ${docFields.category}`,
      performedBy: session.user.id,
    })

    // Workforce tracking
    try {
      const { trackEmployeeActivity, getEmployeeByUserId } = await import("@/lib/workforce/tracker")
      const employee = await getEmployeeByUserId(session.user.id)
      if (employee) {
        await trackEmployeeActivity({
          employeeId: employee.id,
          userId: session.user.id,
          activityType: "DOCUMENT_UPLOADED",
          description: `Uploaded document "${docFields.title}"`,
          entityType: "DOCUMENT",
          entityId: document.id,
          entityName: docFields.title,
        })
      }
    } catch (logErr) { console.error("document activity log failed:", logErr) }

    revalidatePath("/documents")
    revalidatePath(`/clients/${docFields.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to upload documents." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to upload document. Please try again." }
  }
}

/**
 * Client-side upload support (enables progress bar):
 * 1) createDocumentUploadUrl() → returns short-lived signed upload URL + storagePath
 * 2) browser PUTs file to signed URL (with progress)
 * 3) finalizeDocumentUpload() → creates DB record + activity logs
 */
export async function createDocumentUploadUrl(input: {
  clientId: string
  fileName: string
  fileType: string
  fileSize: number
}): Promise<{ storagePath?: string; signedUrl?: string; error?: string }> {
  try {
    const session = await requireAuth()
    const executiveEmployeeId = await getExecutiveEmployeeId(session)

    const bucketCheck = await assertDocumentBucketExists()
    if (bucketCheck.error) return { error: bucketCheck.error }

    // Validate metadata-level constraints early (client also does full signature checks)
    const mime = input.fileType as AllowedMimeType
    if (!(mime in ALLOWED_UPLOADS)) {
      return { error: "File type not allowed." }
    }
    if (input.fileSize <= 0) return { error: "File is required." }
    if (input.fileSize > MAX_FILE_SIZE) {
      const mb = Math.round((MAX_FILE_SIZE / (1024 * 1024)) * 10) / 10
      return { error: `File size exceeds the ${mb} MB limit.` }
    }

    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
    })
    if (!client) return { error: "Client not found." }
    if (
      !canAccessAssignedClient(session, executiveEmployeeId, client.assignedEmployeeId)
    ) {
      return { error: "You can only upload documents for clients assigned to you" }
    }

    const safeFileName = sanitizeFileName(input.fileName)
    const objectId = crypto.randomUUID()
    const storagePath = `documents/${input.clientId}/${objectId}-${safeFileName}`

    const signed = await createSignedUploadUrl(storagePath, { upsert: false })
    if (signed.error || !signed.data?.signedUrl) {
      return { error: signed.error || "Failed to create signed upload URL" }
    }

    return { storagePath, signedUrl: signed.data.signedUrl }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function finalizeDocumentUpload(
  input: {
    storagePath: string
    title: string
    category: string
    clientId: string
    description?: string
    isConfidential: boolean
    fileName: string
    fileType: string
    fileSize: number
  }
): Promise<DocumentActionState> {
  try {
    const session = await requireAuth()
    const executiveEmployeeId = await getExecutiveEmployeeId(session)

    const bucketCheck = await assertDocumentBucketExists()
    if (bucketCheck.error) return { error: bucketCheck.error }

    // Ensure the object exists before creating DB rows
    const exists = await fileExists(input.storagePath)
    if (exists.error) return { error: `Storage check failed: ${exists.error}` }
    if (!exists.data?.exists) return { error: "Upload not found in storage. Please retry." }

    // Validate metadata
    const parsed = documentSchema.safeParse({
      title: input.title,
      category: input.category,
      clientId: input.clientId,
      description: input.description,
      isConfidential: input.isConfidential,
    })
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    // Validate type/size consistency (content signature is validated on client + server upload path)
    const mime = input.fileType as AllowedMimeType
    if (!(mime in ALLOWED_UPLOADS)) {
      return { error: "File type not allowed." }
    }
    if (input.fileSize <= 0) return { error: "File is required." }
    if (input.fileSize > MAX_FILE_SIZE) {
      const mb = Math.round((MAX_FILE_SIZE / (1024 * 1024)) * 10) / 10
      return { error: `File size exceeds the ${mb} MB limit.` }
    }
    const ext = getFileExtension(input.fileName)
    const allowedExts = ALLOWED_UPLOADS[mime].exts as readonly string[]
    if (!allowedExts.includes(ext)) {
      return { error: "File extension does not match file type." }
    }

    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
    })
    if (!client) return { error: "Client not found." }
    if (
      !canAccessAssignedClient(session, executiveEmployeeId, client.assignedEmployeeId)
    ) {
      return { error: "You can only upload documents for clients assigned to you" }
    }

    // Idempotency guard: if finalize is retried, avoid duplicate DB rows.
    const existing = await prisma.document.findFirst({
      where: { storagePath: input.storagePath },
      select: { id: true },
    })
    if (existing) {
      revalidatePath("/documents")
      revalidatePath(`/clients/${parsed.data.clientId}`)
      return { success: true }
    }

    const document = await prisma.document.create({
      data: {
        ...parsed.data,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileType: input.fileType,
        storagePath: input.storagePath,
        uploadedBy: session.user.id,
        version: 1,
      },
    })

    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 1,
        fileName: input.fileName,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        uploadedBy: session.user.id,
      },
    })

    await prisma.documentActivity.create({
      data: {
        documentId: document.id,
        userId: session.user.id,
        activityType: "UPLOADED",
        metadata: {
          fileName: input.fileName,
          fileSize: input.fileSize,
        },
      },
    })

    revalidatePath("/documents")
    revalidatePath(`/clients/${parsed.data.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) return { error: toUserError(error) }
    return { error: "Failed to finalize upload. Please try again." }
  }
}

export async function renameDocumentFile(
  documentId: string,
  newFileName: string
): Promise<DocumentActionState> {
  try {
    const session = await requirePartnerOrManager()

    const bucketCheck = await assertDocumentBucketExists()
    if (bucketCheck.error) return { error: bucketCheck.error }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })
    if (!document) return { error: "Document not found" }

    const oldFileName = document.fileName
    const oldExt = getFileExtension(oldFileName)
    const sanitizedNew = sanitizeFileName(newFileName)
    const newExt = getFileExtension(sanitizedNew)

    if (!newExt || newExt !== oldExt) {
      return { error: `File extension must remain ".${oldExt}".` }
    }

    const folder = document.storagePath.split("/").slice(0, -1).join("/")
    const oldBase = document.storagePath.split("/").pop() || ""
    const prefix = oldBase.includes("-") ? oldBase.split("-")[0] : crypto.randomUUID()
    const newStoragePath = `${folder}/${prefix}-${sanitizedNew}`

    if (newStoragePath !== document.storagePath) {
      const moved = await moveFile(document.storagePath, newStoragePath)
      if (moved.error) return { error: `Rename failed: ${moved.error}` }

      // Keep versions consistent if they pointed to the same object
      await prisma.documentVersion.updateMany({
        where: { storagePath: document.storagePath },
        data: { storagePath: newStoragePath, fileName: sanitizedNew },
      })
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        fileName: sanitizedNew,
        storagePath: newStoragePath,
      },
    })

    await prisma.documentActivity.create({
      data: {
        documentId,
        userId: session.user.id,
        activityType: "RENAMED",
        metadata: {
          oldFileName,
          newFileName: sanitizedNew,
        },
      },
    })

    revalidatePath("/documents")
    revalidatePath(`/documents/${documentId}`)
    revalidatePath(`/clients/${document.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) return { error: toUserError(error) }
    return { error: "Failed to rename document. Please try again." }
  }
}

// C-04 fix: generate a signed download URL for a document
export async function getDocumentDownloadUrl(documentId: string): Promise<{ url?: string; error?: string }> {
  try {
    const session = await requireAuth()

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { client: true },
    })

    if (!document) {
      return { error: "Document not found" }
    }

    const accessError = await assertClientDocumentAccess(
      session,
      document.clientId,
      "You do not have permission to download this document"
    )
    if (accessError) return { error: accessError }

    const result = await getSignedUrl(document.storagePath, 3600)
    if (result.error) {
      return { error: `Could not generate download link: ${result.error}` }
    }

    // Log download activity
    await prisma.documentActivity.create({
      data: {
        documentId,
        userId: session.user.id,
        activityType: "DOWNLOADED",
      },
    })

    return { url: result.data!.signedUrl }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to generate download link. Please try again." }
  }
}

export async function updateDocument(
  _prevState: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  try {
    const session = await requireAuth()

    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return { error: "Missing document id" }
    }

    const document = await prisma.document.findUnique({
      where: { id },
    })

    if (!document) {
      return { error: "Document not found" }
    }

    const accessError = await assertClientDocumentAccess(
      session,
      document.clientId,
      "You can only edit documents for clients assigned to you"
    )
    if (accessError) return { error: accessError }

    const raw = {
      title: formData.get("title"),
      category: formData.get("category"),
      description: formData.get("description") || undefined,
      isConfidential: formData.get("isConfidential") === "true",
    }

    const parsed = documentSchema.partial().safeParse(raw)

    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    const oldTitle = document.title
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: parsed.data,
    })

    if (oldTitle !== updatedDocument.title) {
      await prisma.documentActivity.create({
        data: {
          documentId: id,
          userId: session.user.id,
          activityType: "RENAMED",
          metadata: {
            oldTitle,
            newTitle: updatedDocument.title,
          },
        },
      })
    }

    revalidatePath("/documents")
    revalidatePath(`/documents/${id}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to edit documents." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to update document. Please try again." }
  }
}

export async function deleteDocument(documentId: string): Promise<DocumentActionState> {
  try {
    await requirePartnerOrManager()

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return { error: "Document not found" }
    }

    // C-03 fix: delete the actual file from Supabase Storage before removing the DB record
    if (document.storagePath) {
      const deleteResult = await deleteFile(document.storagePath)
      if (deleteResult.error) {
        // Log but don't block â€” the DB record should still be removed
        console.error("Storage delete failed:", deleteResult.error)
      }
    }

    await prisma.document.delete({
      where: { id: documentId },
    })

    revalidatePath("/documents")
    revalidatePath(`/clients/${document.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to delete documents." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to delete document. Please try again." }
  }
}

export async function addDocumentTag(documentId: string, tag: string): Promise<DocumentActionState> {
  try {
    const session = await requireAuth()

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return { error: "Document not found" }
    }

    const tagAccessError = await assertClientDocumentAccess(
      session,
      document.clientId,
      "You can only tag documents for clients assigned to you"
    )
    if (tagAccessError) return { error: tagAccessError }

    await prisma.documentTag.create({
      data: {
        documentId,
        tag: tag.toLowerCase(),
      },
    })

    await prisma.documentActivity.create({
      data: {
        documentId,
        userId: session.user.id,
        activityType: "TAG_ADDED",
        metadata: { tag },
      },
    })

    revalidatePath("/documents")
    revalidatePath(`/documents/${documentId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return { success: true }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to add tag. Please try again." }
  }
}

export async function removeDocumentTag(documentId: string, tag: string): Promise<DocumentActionState> {
  try {
    const session = await requireAuth()

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return { error: "Document not found" }
    }

    const removeTagAccessError = await assertClientDocumentAccess(
      session,
      document.clientId,
      "You can only tag documents for clients assigned to you"
    )
    if (removeTagAccessError) return { error: removeTagAccessError }

    await prisma.documentTag.deleteMany({
      where: {
        documentId,
        tag: tag.toLowerCase(),
      },
    })

    await prisma.documentActivity.create({
      data: {
        documentId,
        userId: session.user.id,
        activityType: "TAG_REMOVED",
        metadata: { tag },
      },
    })

    revalidatePath("/documents")
    revalidatePath(`/documents/${documentId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to remove tag. Please try again." }
  }
}

export async function getDocumentDetail(documentId: string) {
  const session = await requireAuth()
  
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      client: true,
      tags: true,
      versions: {
        orderBy: { version: "desc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  })

  if (!document) {
    throw new Error("Document not found")
  }

  const viewAccessError = await assertClientDocumentAccess(
    session,
    document.clientId,
    "You do not have permission to view this document"
  )
  if (viewAccessError) {
    throw new Error(viewAccessError)
  }

  await prisma.documentActivity.create({
    data: {
      documentId,
      userId: session.user.id,
      activityType: "VIEWED",
    },
  })

  return { document, user: session.user }
}

// ─── Document Completeness Score ────────────────────────────────────────────

const EXPECTED_DOCUMENT_CATEGORIES_BY_SERVICE: Record<string, string[]> = {
  GST_RETURN: ["GST", "INVOICES", "BANK_STATEMENTS"],
  INCOME_TAX: ["INCOME_TAX", "BANK_STATEMENTS", "INVOICES"],
  TDS: ["TDS", "BANK_STATEMENTS"],
  PAYROLL: ["PAYROLL"],
  BOOKKEEPING: ["BANK_STATEMENTS", "INVOICES"],
  AUDIT: ["AUDIT", "BANK_STATEMENTS", "INVOICES", "AGREEMENTS"],
  COMPANY_LAW: ["ROC", "AGREEMENTS"],
  OTHER: [],
}

export async function getClientDocumentCompleteness(clientId: string) {
  const services = await prisma.clientService.findMany({
    where: { clientId, isActive: true },
    select: { serviceType: true },
  })

  const expectedCategories = new Set<string>()
  for (const s of services) {
    const cats = EXPECTED_DOCUMENT_CATEGORIES_BY_SERVICE[s.serviceType] || []
    for (const c of cats) expectedCategories.add(c)
  }

  // Always expect PAN for Indian clients
  expectedCategories.add("INCOME_TAX")

  const docs = await prisma.document.findMany({
    where: { clientId },
    select: { category: true, expiryDate: true },
  })

  const receivedCategories = new Set(docs.map((d) => d.category as string))
  const totalExpected = expectedCategories.size || 1
  const totalReceived = [...expectedCategories].filter((c) => receivedCategories.has(c)).length

  const score = Math.round((totalReceived / totalExpected) * 100)

  const now = new Date()
  const expiringSoon = docs.filter(
    (d) => d.expiryDate && d.expiryDate > now && d.expiryDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  ).length

  const expired = docs.filter((d) => d.expiryDate && d.expiryDate <= now).length

  return {
    score,
    totalExpected,
    totalReceived,
    totalDocuments: docs.length,
    pendingCategories: [...expectedCategories].filter((c) => !receivedCategories.has(c)),
    expiringSoon,
    expired,
  }
}

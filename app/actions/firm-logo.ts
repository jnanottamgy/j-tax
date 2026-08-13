"use server"

import { revalidatePath } from "next/cache"

import { requirePartner } from "@/lib/auth/guards"
import { removeFirmLogo, saveFirmLogo } from "@/lib/firm-settings"

/**
 * Firm letterhead — upload, read, remove.
 *
 * The client downscales and re-encodes the image before it gets here, but the
 * server re-checks everything: a data URL is trivially hand-crafted, and this
 * blob is later handed straight to pdfkit.
 */

/** Raw bytes ceiling after decoding. Comfortably above a downscaled PNG. */
const MAX_LOGO_BYTES = 400 * 1024

/**
 * PNG and JPEG only.
 *
 * pdfkit can embed exactly these two. SVG would need rasterising and WebP is
 * not supported at all, so accepting them here would produce a logo that shows
 * in the browser and then silently breaks every invoice PDF.
 */
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"])

/** First bytes of the file, checked against the declared MIME type. */
function sniffMime(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png"
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg"
  }
  return null
}

export async function uploadFirmLogo(
  dataUrl: string,
  fileName?: string
): Promise<{ success: boolean; error?: string; logoUpdatedAt?: string }> {
  let session
  try {
    session = await requirePartner()
  } catch {
    return { success: false, error: "Only a partner can change the firm logo." }
  }

  const match = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) {
    return { success: false, error: "That doesn't look like an image file." }
  }
  const [, declaredMime, base64] = match

  if (!ALLOWED_MIME.has(declaredMime.toLowerCase())) {
    return {
      success: false,
      error: "Use a PNG or JPEG. Those are the formats that can be printed on your PDFs.",
    }
  }

  let bytes: Buffer
  try {
    bytes = Buffer.from(base64, "base64")
  } catch {
    return { success: false, error: "That image could not be read. Try another file." }
  }

  if (bytes.length === 0) {
    return { success: false, error: "That image is empty." }
  }
  if (bytes.length > MAX_LOGO_BYTES) {
    return {
      success: false,
      error: `That image is ${Math.round(bytes.length / 1024)} KB. Please use one under ${MAX_LOGO_BYTES / 1024} KB.`,
    }
  }

  // Trust the bytes, not the label — a mislabelled file would be accepted here
  // and then throw inside pdfkit at invoice-download time.
  const actualMime = sniffMime(bytes)
  if (!actualMime || actualMime !== declaredMime.toLowerCase()) {
    return {
      success: false,
      error: "That file isn't a valid PNG or JPEG image.",
    }
  }

  try {
    const at = await saveFirmLogo(
      bytes,
      actualMime,
      fileName?.trim().slice(0, 120) || null,
      session.user.id
    )
    revalidatePath("/settings")
    revalidatePath("/")
    return { success: true, logoUpdatedAt: at.toISOString() }
  } catch (e) {
    console.error("Firm logo upload failed:", e)
    return { success: false, error: "Could not save the logo. Please try again." }
  }
}

export async function deleteFirmLogo(): Promise<{ success: boolean; error?: string }> {
  let session
  try {
    session = await requirePartner()
  } catch {
    return { success: false, error: "Only a partner can change the firm logo." }
  }

  try {
    await removeFirmLogo(session.user.id)
    revalidatePath("/settings")
    revalidatePath("/")
    return { success: true }
  } catch (e) {
    console.error("Firm logo removal failed:", e)
    return { success: false, error: "Could not remove the logo. Please try again." }
  }
}

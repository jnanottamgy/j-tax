/**
 * What a client is allowed to upload, and where it lands.
 *
 * The document vault has had a model and working Supabase storage helpers since
 * it was built, and `prisma.document.create` appears nowhere — nothing has ever
 * written to it. So the collection loop ran: the firm raised a document request,
 * the client saw a list of what was wanted on their portal, and then had to
 * email the files anyway. Half a loop is arguably worse than none, because the
 * request looks tracked while the fulfilment is invisible.
 *
 * Everything here is pure so the rules can be tested without a bucket, and so
 * the same rules apply wherever an upload starts.
 *
 * The security posture matters more than usual: this is the one place an
 * unauthenticated-adjacent party — a client, not staff — puts bytes on the
 * firm's infrastructure.
 */

/** 25 MB. A scanned 40-page audit file is around 8 MB; a phone photo, 5. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Types a client legitimately sends a CA firm.
 *
 * An allow-list, not a block-list. Blocking `.exe` and hoping is how a
 * double-extension or an unknown MIME slips through; anything not named here is
 * refused, including archives — a zip cannot be scanned or previewed, and
 * "send the PDFs individually" is a reasonable thing to ask.
 */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/heic": ["heic"],
  "text/csv": ["csv"],
  "application/vnd.ms-excel": ["xls", "csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
}

export const ALLOWED_EXTENSIONS = [
  ...new Set(Object.values(ALLOWED_UPLOAD_TYPES).flat()),
]

export type UploadCheck = { ok: true } | { ok: false; error: string }

const extensionOf = (fileName: string): string =>
  fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : ""

export function validateUpload(input: {
  fileName: string
  fileSize: number
  fileType: string
}): UploadCheck {
  const name = input.fileName.trim()
  if (!name) return { ok: false, error: "That file has no name." }

  if (!(input.fileSize > 0)) return { ok: false, error: "That file is empty." }
  if (input.fileSize > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `That file is ${(input.fileSize / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB — try scanning at a lower resolution, or send it in parts.`,
    }
  }

  const allowedExts = ALLOWED_UPLOAD_TYPES[input.fileType.toLowerCase()]
  if (!allowedExts) {
    return {
      ok: false,
      error: `${input.fileType || "That file type"} isn't accepted. Send a PDF, an image, or a Word/Excel file.`,
    }
  }

  // The extension must agree with the declared type. A browser reporting
  // application/pdf for "statement.exe" is the shape of the attack this
  // catches, and it costs one comparison.
  const ext = extensionOf(name)
  if (!ext || !allowedExts.includes(ext)) {
    return {
      ok: false,
      error: `The file name ends in ".${ext || "?"}" but the file says it is ${input.fileType}. Rename it to match, or re-export it.`,
    }
  }

  return { ok: true }
}

/**
 * A file name safe to put in a storage key.
 *
 * Never used to *locate* anything — the path is composed from ids we already
 * trust — but a client-supplied name still reaches object storage, so traversal
 * segments, control characters and separators come out. The result keeps enough
 * of the original that a partner opening the bucket can still recognise it.
 */
export function sanitiseFileName(fileName: string): string {
  const ext = extensionOf(fileName)
  const stem = (ext ? fileName.slice(0, -(ext.length + 1)) : fileName)
    // Strip anything that could act as a separator or an escape.
    .replace(/[^\p{L}\p{N}\-_. ]/gu, "")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 80)
    .trim()

  const safeStem = stem || "document"
  return ext ? `${safeStem}.${ext}` : safeStem
}

/**
 * Where an uploaded file lives.
 *
 * Firm first, so one tenant's objects can never be enumerated from another's
 * prefix; then client, then the request item it answers. `unique` is supplied
 * by the caller (a cuid) rather than generated here, so this stays pure and the
 * path is reproducible in a test.
 */
export function buildStoragePath(input: {
  firmId: string
  clientId: string
  requestItemId: string
  fileName: string
  unique: string
}): string {
  return [
    input.firmId,
    input.clientId,
    "requests",
    input.requestItemId,
    `${input.unique}-${sanitiseFileName(input.fileName)}`,
  ].join("/")
}

/** Broad bucket for the vault's category column, from the MIME type. */
export function documentCategoryFor(fileType: string): "OTHER" {
  // Deliberately one value for now. The client answering a request does not
  // know the firm's filing taxonomy, and a guessed category is worse than an
  // honest "OTHER" that a reviewer re-files when they accept it.
  return "OTHER"
}

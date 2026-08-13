"use client"

/**
 * Firm letterhead upload.
 *
 * Shared by onboarding Step 1 and Settings → Firm Details so a firm is asked
 * for its logo exactly once, wherever it happens to look first.
 *
 * The file is downscaled and re-encoded in the browser before it is sent. A
 * partner will reach for whatever is on their desktop — often a 3000px export
 * straight from a designer — and the useful size on an A4 header band is about
 * 56pt. Shrinking here keeps the stored blob in the tens of KB instead of the
 * megabytes, which matters because the bytes are read back on every PDF.
 */

import { useRef, useState } from "react"
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { deleteFirmLogo, uploadFirmLogo } from "@/app/actions/firm-logo"
import { cn } from "@/lib/utils"

/** Longest edge after downscaling. ~4x the printed size, so it stays crisp. */
const MAX_EDGE = 600
/** Above this, re-encode as JPEG instead of PNG. Server hard-caps at 400 KB. */
const PNG_BUDGET_BYTES = 300 * 1024

function base64Bytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",")
  if (i === -1) return 0
  // 4 base64 chars → 3 bytes, minus padding.
  const b64 = dataUrl.slice(i + 1)
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Could not read that image."))
      img.src = url
    })
  } finally {
    // Revoking immediately is safe: decoding has finished by the time onload
    // fires, and the element keeps its own reference to the decoded bitmap.
    URL.revokeObjectURL(url)
  }
}

/** Downscale to MAX_EDGE and re-encode. PNG first (keeps transparency), JPEG if too big. */
async function normalise(file: File): Promise<string> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser could not process that image.")
  ctx.drawImage(img, 0, 0, w, h)

  const png = canvas.toDataURL("image/png")
  if (base64Bytes(png) <= PNG_BUDGET_BYTES) return png

  // Photographic logos blow past the PNG budget. JPEG has no alpha channel, so
  // paint white underneath first — otherwise transparent areas come out black.
  const flat = document.createElement("canvas")
  flat.width = w
  flat.height = h
  const fctx = flat.getContext("2d")
  if (!fctx) throw new Error("Your browser could not process that image.")
  fctx.fillStyle = "#ffffff"
  fctx.fillRect(0, 0, w, h)
  fctx.drawImage(canvas, 0, 0)
  return flat.toDataURL("image/jpeg", 0.85)
}

export function FirmLogoUpload({
  initialLogoUpdatedAt,
  className,
  onChange,
}: {
  /** ISO timestamp of the stored logo, or null when the firm has none. */
  initialLogoUpdatedAt?: string | null
  className?: string
  onChange?: (hasLogo: boolean) => void
}) {
  // Preview source: the freshly-picked data URL while uploading, then the
  // served route (versioned so a replacement busts the browser cache).
  const [preview, setPreview] = useState<string | null>(
    initialLogoUpdatedAt ? `/api/firm/logo?v=${encodeURIComponent(initialLogoUpdatedAt)}` : null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    setError("")

    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      setError("Use a PNG or JPEG — those are the formats that print on your PDFs.")
      return
    }

    setBusy(true)
    try {
      const dataUrl = await normalise(file)
      setPreview(dataUrl)
      const result = await uploadFirmLogo(dataUrl, file.name)
      if (!result.success) {
        setError(result.error ?? "Could not save the logo.")
        setPreview(
          initialLogoUpdatedAt
            ? `/api/firm/logo?v=${encodeURIComponent(initialLogoUpdatedAt)}`
            : null
        )
        return
      }
      setPreview(`/api/firm/logo?v=${encodeURIComponent(result.logoUpdatedAt ?? "")}`)
      onChange?.(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleRemove() {
    setBusy(true)
    setError("")
    try {
      const result = await deleteFirmLogo()
      if (!result.success) {
        setError(result.error ?? "Could not remove the logo.")
        return
      }
      setPreview(null)
      onChange?.(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-4">
        {/* Light chip behind the preview: the PDF header band is dark navy and
            draws the logo on a white plate, so this matches what prints. */}
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.12] bg-white p-2">
          {preview ? (
            /* Bytes come from our own route with no known dimensions, and the
               optimizer adds nothing for an already-downscaled logo shown at
               64px. next/image would also need the route allow-listed. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Firm logo"
              className="max-h-full max-w-full object-contain"
              onError={() => setPreview(null)}
            />
          ) : (
            <ImageIcon className="size-6 text-neutral-400" />
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="gap-2"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {preview ? "Replace logo" : "Upload logo"}
            </Button>
            {preview && !busy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="gap-2 text-muted-foreground"
              >
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG or JPEG. Printed on your invoices and quotations — a square or
            wide logo on a transparent or white background works best.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}

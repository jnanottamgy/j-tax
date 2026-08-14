"use client"

/**
 * The client's side of a document request: actually sending the files.
 *
 * The portal already listed what the firm had asked for and offered no way to
 * answer it, so every client emailed their documents anyway and the request sat
 * OPEN until somebody closed it by hand.
 *
 * The file goes straight from the browser to storage against a short-lived
 * signed URL. That is not an optimisation — a scanned audit file is larger than
 * a server action's body limit, so routing it through the app server would fail
 * on exactly the documents this exists to collect.
 */

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, FileUp, Loader2, RotateCcw, Upload, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  confirmRequestedUpload,
  createUploadSlot,
  getMyDocumentRequests,
  withdrawUploadedDocument,
  type PortalDocumentRequest,
  type PortalRequestItem,
} from "@/app/actions/portal-documents"
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/documents/upload-rules"

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null

export function PortalDocumentsClient() {
  const [requests, setRequests] = useState<PortalDocumentRequest[] | null>(null)
  const [busyItem, setBusyItem] = useState<string | null>(null)

  const load = () =>
    getMyDocumentRequests()
      .then(setRequests)
      .catch(() => setRequests([]))

  useEffect(() => {
    let cancelled = false
    getMyDocumentRequests()
      .then((r) => { if (!cancelled) setRequests(r) })
      .catch(() => { if (!cancelled) setRequests([]) })
    return () => { cancelled = true }
  }, [])

  async function upload(item: PortalRequestItem, file: File) {
    setBusyItem(item.id)
    try {
      const slot = await createUploadSlot({
        itemId: item.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
      if ("error" in slot) {
        toast.error(slot.error)
        return
      }

      // Direct PUT to storage. A failure here leaves nothing recorded, which is
      // the right outcome — confirmRequestedUpload checks the object exists
      // before it writes anything.
      const res = await fetch(slot.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!res.ok) {
        toast.error("The upload didn't finish. Please try again.")
        return
      }

      const done = await confirmRequestedUpload({
        itemId: item.id,
        path: slot.path,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
      if (!done.success) {
        toast.error(done.error ?? "Could not record the upload.")
        return
      }

      toast.success(`${file.name} sent to your accountant.`)
      await load()
    } catch {
      toast.error("Something went wrong sending that file.")
    } finally {
      setBusyItem(null)
    }
  }

  async function withdraw(item: PortalRequestItem) {
    setBusyItem(item.id)
    const result = await withdrawUploadedDocument(item.id)
    setBusyItem(null)
    if (!result.success) {
      toast.error(result.error ?? "Could not withdraw that file.")
      return
    }
    toast.success("File withdrawn.")
    await load()
  }

  if (requests === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  const open = requests.filter((r) => r.items.some((i) => i.status !== "ACCEPTED"))
  const settled = requests.filter((r) => r.items.every((i) => i.status === "ACCEPTED"))

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-12 text-center">
        <FileUp className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">Nothing has been requested</p>
        <p className="mt-1 text-sm text-muted-foreground">
          When your accountant needs a document from you, it will appear here and you can
          send it straight back.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {open.map((req) => (
        <section key={req.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">{req.title}</h2>
            {req.dueDate && (
              <span className="text-xs text-muted-foreground">
                Needed by {fmtDate(req.dueDate)}
              </span>
            )}
          </div>
          {req.notes && <p className="mt-1 text-sm text-muted-foreground">{req.notes}</p>}

          <ul className="mt-4 flex flex-col divide-y divide-white/[0.05]">
            {req.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {item.status === "ACCEPTED" && (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden />
                    )}
                    {item.status === "REJECTED" && (
                      <XCircle className="size-4 shrink-0 text-red-400" aria-hidden />
                    )}
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.status === "ACCEPTED"
                      ? `Accepted — ${item.fileName ?? "received"}`
                      : item.status === "UPLOADED"
                        ? `Sent — ${item.fileName ?? "waiting to be checked"}`
                        : item.status === "REJECTED"
                          ? (
                            <span className="text-red-400">
                              Sent back{item.rejectionReason ? `: ${item.rejectionReason}` : ""}. Please
                              send a replacement.
                            </span>
                          )
                          : "Not sent yet"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {item.status === "UPLOADED" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={busyItem === item.id}
                      onClick={() => void withdraw(item)}
                    >
                      <RotateCcw className="mr-1.5 size-3.5" />
                      Withdraw
                    </Button>
                  )}
                  {item.status !== "ACCEPTED" && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept={ACCEPT}
                        className="sr-only"
                        disabled={busyItem === item.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          // Reset so choosing the same file twice re-fires.
                          e.target.value = ""
                          if (file) void upload(item, file)
                        }}
                      />
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 text-xs font-medium transition-colors hover:bg-white/[0.05]">
                        {busyItem === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Upload className="size-3.5" />
                        )}
                        {item.status === "PENDING" ? "Send file" : "Replace"}
                      </span>
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {settled.length > 0 && (
        <section>
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Completed</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {settled.map((req) => (
              <li key={req.id} className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden />
                {req.title} — everything received
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Accepted formats: {ALLOWED_EXTENSIONS.join(", ")}. Up to{" "}
        {MAX_UPLOAD_BYTES / 1024 / 1024} MB per file.
      </p>
    </div>
  )
}

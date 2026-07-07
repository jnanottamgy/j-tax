"use client"

/**
 * Bulk client CSV import — upload → map columns → validated preview → import.
 *
 * Validation preview runs the same offline validators the server enforces
 * (GSTIN checksum, PAN structure, GSTIN↔PAN cross-check), so surprises at
 * import time are rare. The server remains the source of truth and re-checks
 * every row plus duplicates against the live database.
 */

import { useMemo, useRef, useState } from "react"
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { parseCsv } from "@/lib/csv/parse"
import { validateGSTIN, validatePAN, gstinPanMismatch } from "@/lib/india/validators"
import {
  importClients,
  exportClientsCsv,
  type ImportClientRow,
  type ImportClientsResult,
} from "@/app/actions/clients-import"
import { cn } from "@/lib/utils"

// ─── Field mapping ───────────────────────────────────────────────────────────

const TARGET_FIELDS = [
  { key: "name", label: "Client name", required: true },
  { key: "gstin", label: "GSTIN", required: false },
  { key: "pan", label: "PAN", required: false },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "whatsapp", label: "WhatsApp", required: false },
  { key: "address", label: "Address", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "priority", label: "Priority", required: false },
  { key: "services", label: "Services", required: false },
] as const

type TargetKey = (typeof TARGET_FIELDS)[number]["key"]

const HEADER_ALIASES: Record<TargetKey, string[]> = {
  name: ["name", "clientname", "client", "companyname", "company", "legalname", "tradename"],
  gstin: ["gstin", "gstno", "gstnumber", "gst"],
  pan: ["pan", "panno", "pannumber"],
  email: ["email", "emailid", "mail", "emailaddress"],
  phone: ["phone", "mobile", "phoneno", "mobileno", "contact", "contactno", "phonenumber"],
  whatsapp: ["whatsapp", "whatsappno", "whatsappnumber", "wanumber"],
  address: ["address", "registeredaddress", "addr", "officeaddress"],
  notes: ["notes", "remarks", "comments", "note"],
  priority: ["priority"],
  services: ["services", "service", "servicetypes", "engagements"],
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function autoMap(headers: string[]): Record<TargetKey, number | null> {
  const normalized = headers.map(normalizeHeader)
  const map = {} as Record<TargetKey, number | null>
  const taken = new Set<number>()
  for (const field of TARGET_FIELDS) {
    let found: number | null = null
    for (const alias of HEADER_ALIASES[field.key]) {
      const idx = normalized.findIndex((h, i) => h === alias && !taken.has(i))
      if (idx !== -1) {
        found = idx
        break
      }
    }
    if (found !== null) taken.add(found)
    map[field.key] = found
  }
  return map
}

// ─── Row validation preview (advisory; server re-validates) ─────────────────

function rowIssue(row: ImportClientRow): string | null {
  if (!row.name?.trim()) return "Client name is required"
  if (row.name.trim().length < 2) return "Client name too short"
  if (row.gstin?.trim()) {
    const r = validateGSTIN(row.gstin)
    if (!r.valid) return `GSTIN: ${r.error}`
  }
  if (row.pan?.trim()) {
    const r = validatePAN(row.pan)
    if (!r.valid) return `PAN: ${r.error}`
  }
  const mismatch = gstinPanMismatch(row.gstin, row.pan)
  if (mismatch) return mismatch
  if (row.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    return `Email "${row.email.trim()}" looks invalid`
  }
  return null
}

const TEMPLATE_CSV = [
  "name,gstin,pan,email,phone,whatsapp,address,priority,services,notes",
  'Acme Traders Pvt Ltd,27AAPFU0939F1ZV,AAPFU0939F,accounts@acme.in,+91 98765 43210,+91 98765 43210,"12 MG Road, Pune",HIGH,GST_RETURN|INCOME_TAX|TDS,Referred by XYZ',
  "Sunrise Enterprises,,ABCPE1234F,sunrise@example.com,+91 91234 56789,,,MEDIUM,BOOKKEEPING|PAYROLL,",
].join("\r\n")

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ───────────────────────────────────────────────────────────────

type Step = "upload" | "map" | "done"

export function ImportClientsDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("upload")
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<TargetKey, number | null>>(
    () => autoMap([])
  )
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportClientsResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload")
    setFileName("")
    setHeaders([])
    setRows([])
    setResult(null)
    setImporting(false)
  }

  async function handleFile(file: File) {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("That file has no data rows. Check the CSV and try again.")
      return
    }
    setFileName(file.name)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setMapping(autoMap(parsed.headers))
    setStep("map")
  }

  const mappedRows: ImportClientRow[] = useMemo(() => {
    if (headers.length === 0) return []
    return rows.map((r) => {
      const pick = (key: TargetKey) => {
        const idx = mapping[key]
        return idx === null || idx === undefined ? undefined : r[idx]?.trim() || undefined
      }
      return {
        name: pick("name") ?? "",
        gstin: pick("gstin"),
        pan: pick("pan"),
        email: pick("email"),
        phone: pick("phone"),
        whatsapp: pick("whatsapp"),
        address: pick("address"),
        notes: pick("notes"),
        priority: pick("priority"),
        services: pick("services"),
      }
    })
  }, [rows, headers, mapping])

  const issues = useMemo(() => mappedRows.map(rowIssue), [mappedRows])
  const invalidCount = issues.filter(Boolean).length
  const validCount = mappedRows.length - invalidCount

  async function handleImport() {
    setImporting(true)
    try {
      const res = await importClients(mappedRows)
      if (!res.success) {
        toast.error(res.error ?? "Import failed.")
        return
      }
      setResult(res)
      setStep("done")
      if (res.created > 0) {
        toast.success(`Imported ${res.created} client${res.created === 1 ? "" : "s"}.`)
        onSuccess?.()
      }
    } finally {
      setImporting(false)
    }
  }

  function downloadIssues() {
    if (!result) return
    const bad = result.results.filter((r) => r.status !== "created")
    const csv = [
      "row,name,status,reason",
      ...bad.map((r) => `${r.row},"${r.name.replace(/"/g, '""')}",${r.status},"${(r.reason ?? "").replace(/"/g, '""')}"`),
    ].join("\r\n")
    downloadText("import-issues.csv", csv)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="input-premium h-9 gap-1.5 rounded-xl">
          <Upload className="size-3.5" />
          <span className="hidden sm:inline">Import CSV</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/[0.08] bg-popover/95 backdrop-blur-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import clients from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV exported from Excel, Tally, or any practice tool. Up to 500 clients per import."}
            {step === "map" &&
              "Match your file's columns to client fields. GSTIN checksums and PAN structure are verified before anything is created."}
            {step === "done" && "Import complete — every created client is fully provisioned with services, tasks, and compliance schedules."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="surface-elevated flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.12] p-8 transition-colors hover:border-primary/40"
            >
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Choose a CSV file</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  First row must be column headings
                </p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
                e.target.value = ""
              }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Need a starting point?{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => downloadText("client-import-template.csv", TEMPLATE_CSV)}
                >
                  Download the template
                </button>
              </span>
              <span>Services accept GST_RETURN | INCOME_TAX | TDS | AUDIT | …</span>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">{fileName}</span>
              <span>
                {rows.length} data row{rows.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {TARGET_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [field.key]: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="input-premium h-9 w-full rounded-xl bg-transparent px-3 text-sm"
                  >
                    <option value="">— not in file —</option>
                    {headers.map((h, i) => (
                      <option key={`${h}-${i}`} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="surface-elevated overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Client</th>
                    <th className="px-3 py-2 font-medium">GSTIN</th>
                    <th className="px-3 py-2 font-medium">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="max-w-44 truncate px-3 py-2">{r.name || "—"}</td>
                      <td className="px-3 py-2 font-mono">{r.gstin ?? "—"}</td>
                      <td className="px-3 py-2">
                        {issues[i] ? (
                          <span className="text-amber-400">{issues[i]}</span>
                        ) : (
                          <span className="text-emerald-400">✓ ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mappedRows.length > 6 && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">
                  …and {mappedRows.length - 6} more row{mappedRows.length - 6 === 1 ? "" : "s"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                {validCount} ready
              </Badge>
              {invalidCount > 0 && (
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400">
                  {invalidCount} with issues (will be reported, not imported)
                </Badge>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" className="input-premium rounded-xl" onClick={reset}>
                Back
              </Button>
              <Button
                className="btn-glow rounded-xl"
                disabled={importing || mappedRows.length === 0 || mapping.name === null}
                onClick={() => void handleImport()}
              >
                {importing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Importing…
                  </>
                ) : (
                  <>Import {mappedRows.length} row{mappedRows.length === 1 ? "" : "s"}</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="surface-elevated rounded-xl border border-emerald-500/20 p-4">
                <p className="text-2xl font-semibold text-emerald-400">{result.created}</p>
                <p className="text-xs text-muted-foreground">created</p>
              </div>
              <div className="surface-elevated rounded-xl border border-white/[0.06] p-4">
                <p className="text-2xl font-semibold">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">skipped (duplicates)</p>
              </div>
              <div
                className={cn(
                  "surface-elevated rounded-xl border p-4",
                  result.invalid > 0 ? "border-amber-500/30" : "border-white/[0.06]"
                )}
              >
                <p className={cn("text-2xl font-semibold", result.invalid > 0 && "text-amber-400")}>
                  {result.invalid}
                </p>
                <p className="text-xs text-muted-foreground">invalid</p>
              </div>
            </div>

            {result.results.some((r) => r.status !== "created") && (
              <div className="surface-elevated max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] p-3 text-xs">
                {result.results
                  .filter((r) => r.status !== "created")
                  .slice(0, 50)
                  .map((r) => (
                    <p key={r.row} className="py-0.5">
                      <span className="text-muted-foreground">Row {r.row}</span>{" "}
                      <span className="font-medium">{r.name}</span> —{" "}
                      <span className={r.status === "skipped" ? "text-muted-foreground" : "text-amber-400"}>
                        {r.reason}
                      </span>
                    </p>
                  ))}
              </div>
            )}

            <DialogFooter>
              {result.results.some((r) => r.status !== "created") && (
                <Button variant="outline" className="input-premium rounded-xl" onClick={downloadIssues}>
                  <Download className="size-3.5" /> Issues CSV
                </Button>
              )}
              <Button className="btn-glow rounded-xl" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** One-click CSV export of the current client master. */
export function ExportClientsButton() {
  const [exporting, setExporting] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className="input-premium h-9 gap-1.5 rounded-xl"
      disabled={exporting}
      onClick={async () => {
        setExporting(true)
        try {
          const res = await exportClientsCsv()
          if (!res.success) {
            toast.error(res.error)
            return
          }
          downloadText(res.filename, res.csv)
        } finally {
          setExporting(false)
        }
      }}
    >
      {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      <span className="hidden sm:inline">Export</span>
    </Button>
  )
}

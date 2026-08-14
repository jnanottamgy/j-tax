"use client"

/**
 * "It's filed — what's the acknowledgement number?"
 *
 * Asked at the only moment the answer is on screen. Filing history could only
 * be entered from the client's own tab, days later, by someone digging an ARN
 * out of a portal or an email — so the firm's only evidence that a return went
 * in was captured late, or not at all, and never joined to the task that
 * produced it.
 *
 * The task already knows the client, the service and roughly the period, so
 * everything here is pre-filled except the number itself. Skipping is allowed
 * and costs nothing: the task is already marked done, and the filing can still
 * be recorded from the client later. Blocking the status change on a number
 * somebody does not have yet would only teach people to type zeros.
 */

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Receipt } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/forms/form-field"
import { captureTaskFiling } from "@/app/actions/filing-capture"
import { recentFinancialYears } from "@/lib/india/format"

export type FilingPrefill = {
  taskId: string
  taskTitle: string
  clientName: string
  /** Best guess at what was filed, from the task's service type. */
  filingType: string
  /** Best guess at the year the return relates to. */
  financialYear: string
  period: string
}

const todayIso = () => new Date().toISOString().split("T")[0]

export function RecordFilingDialog({
  prefill,
  open,
  onOpenChange,
  onDone,
}: {
  prefill: FilingPrefill | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after save or skip, so the caller can continue its own flow. */
  onDone: () => void
}) {
  const [filingType, setFilingType] = useState("")
  const [financialYear, setFinancialYear] = useState("")
  const [period, setPeriod] = useState("")
  const [filedOn, setFiledOn] = useState(todayIso)
  const [ackNo, setAckNo] = useState("")
  const [udin, setUdin] = useState("")
  const [udinDocumentType, setUdinDocumentType] = useState("")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [seeded, setSeeded] = useState<string | null>(null)

  // Seed once per task rather than in an effect — the dialog opens with the
  // prefill already known, and an effect would fight the user's own typing.
  if (prefill && seeded !== prefill.taskId) {
    setSeeded(prefill.taskId)
    setFilingType(prefill.filingType)
    setFinancialYear(prefill.financialYear)
    setPeriod(prefill.period)
    setFiledOn(todayIso())
    setAckNo("")
    setUdin("")
    setUdinDocumentType("")
    setErrors({})
  }

  if (!prefill) return null

  function close() {
    onOpenChange(false)
    onDone()
  }

  async function save() {
    if (!prefill) return
    setSaving(true)
    setErrors({})
    const result = await captureTaskFiling({
      taskId: prefill.taskId,
      filingType,
      financialYear,
      period: period || undefined,
      filedOn,
      acknowledgementNo: ackNo || undefined,
      udin: udin || undefined,
      udinDocumentType: udinDocumentType || undefined,
    })
    setSaving(false)

    if (result.fieldErrors) {
      setErrors(result.fieldErrors)
      return
    }
    if (!result.success) {
      toast.error(result.error ?? "Could not save the filing.")
      return
    }
    toast.success(ackNo ? `Filing recorded — ${ackNo}` : "Filing recorded")
    close()
  }

  const err = (k: string) => errors[k]?.[0]

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Receipt className="size-4 text-primary" aria-hidden />
            Record the filing
          </DialogTitle>
          <DialogDescription>
            {prefill.clientName} · {prefill.taskTitle}. The acknowledgement number is the
            firm&apos;s only evidence the return went in — capture it while you have it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="What was filed" htmlFor="filingType" required error={err("filingType")}>
              <Input
                id="filingType"
                value={filingType}
                onChange={(e) => setFilingType(e.target.value)}
                placeholder="GSTR-3B"
                className="input-premium h-10 rounded-xl"
                disabled={saving}
              />
            </FormField>

            <FormField
              label="Financial year"
              htmlFor="financialYear"
              required
              error={err("financialYear")}
            >
              <select
                id="financialYear"
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={saving}
              >
                {recentFinancialYears(6).map((fy) => (
                  <option key={fy.short} value={fy.short}>
                    {fy.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Period" htmlFor="period" error={err("period")}>
              <Input
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Apr 2026 / Q2 / Annual"
                className="input-premium h-10 rounded-xl"
                disabled={saving}
              />
            </FormField>

            <FormField label="Filed on" htmlFor="filedOn" required error={err("filedOn")}>
              <Input
                id="filedOn"
                type="date"
                value={filedOn}
                onChange={(e) => setFiledOn(e.target.value)}
                className="input-premium h-10 rounded-xl"
                disabled={saving}
              />
            </FormField>
          </div>

          <FormField
            label="Acknowledgement / ARN"
            htmlFor="ackNo"
            error={err("acknowledgementNo")}
          >
            <Input
              id="ackNo"
              value={ackNo}
              onChange={(e) => setAckNo(e.target.value.toUpperCase())}
              placeholder="AA0706250012345"
              className="input-premium h-10 rounded-xl font-mono text-sm tracking-wide"
              disabled={saving}
            />
          </FormField>

          {/* Only for signed deliverables. The UDIN register held numbers with
              nothing pointing at the work; recorded here it lands attached to
              the filing it was generated for. */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-xs text-muted-foreground">
              If this deliverable was signed, record its UDIN here and it will be filed
              against this return rather than sitting loose in the register.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FormField label="UDIN" htmlFor="udin" error={err("udin")}>
                <Input
                  id="udin"
                  value={udin}
                  onChange={(e) => setUdin(e.target.value.toUpperCase())}
                  placeholder="24123456ABCDEF1234"
                  className="input-premium h-9 rounded-lg font-mono text-xs tracking-wide"
                  disabled={saving}
                />
              </FormField>
              <FormField
                label="Signed document"
                htmlFor="udinDocumentType"
                error={err("udinDocumentType")}
              >
                <Input
                  id="udinDocumentType"
                  value={udinDocumentType}
                  onChange={(e) => setUdinDocumentType(e.target.value)}
                  placeholder="Tax Audit Report"
                  className="input-premium h-9 rounded-lg"
                  disabled={saving}
                />
              </FormField>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>
            Not now
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Save filing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

/**
 * Adding a team from a spreadsheet.
 *
 * Clients could be imported since onboarding was built; staff could not, so a
 * firm moving ten people across opened ten dialogs and read out ten temporary
 * passwords.
 *
 * Every row provisions a real login. Where the invite email could not be sent,
 * the temporary password is shown here and nowhere else — losing it means a
 * password reset, so the result list stays on screen until it is dismissed.
 */

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Upload } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { parseCsvObjects } from "@/lib/csv/parse"
import {
  importEmployees,
  type ImportEmployeeResult,
} from "@/app/actions/employees-import"

const TEMPLATE = `name,email,department,role
Rajesh Kumar,rajesh@yourfirm.com,Taxation,EMPLOYEE
Priya Sharma,priya@yourfirm.com,Audit,MANAGER`

export function ImportEmployeesDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ImportEmployeeResult[] | null>(null)

  async function run() {
    const parsed = parseCsvObjects(text)
    if (parsed.length === 0) {
      toast.error("Nothing to import — paste rows with a name and email column.")
      return
    }

    setBusy(true)
    const result = await importEmployees(
      parsed.map((r) => ({
        name: r.name ?? r.Name ?? "",
        email: r.email ?? r.Email ?? "",
        department: r.department ?? r.Department,
        role: r.role ?? r.Role,
      }))
    )
    setBusy(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }

    setResults(result.results)
    toast.success(
      `${result.created} added${result.skipped ? `, ${result.skipped} skipped` : ""}${
        result.failed ? `, ${result.failed} failed` : ""
      }.`
    )
    onImported()
  }

  function close() {
    setText("")
    setResults(null)
    onOpenChange(false)
  }

  const handover = results?.filter((r) => r.tempPassword) ?? []

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Upload className="size-4 text-primary" aria-hidden />
            Import team members
          </DialogTitle>
          <DialogDescription>
            One row per person. Each gets a login and an invite email, the same as
            adding them by hand.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="max-h-[24rem] space-y-3 overflow-y-auto">
            {handover.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                <p className="text-xs text-amber-400">
                  These invites could not be emailed. Give each person their temporary
                  password — they will be asked to change it at first sign-in. This is the
                  only time it is shown.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {handover.map((r) => (
                    <li key={r.email} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate">{r.email}</span>
                      <code className="rounded bg-black/30 px-2 py-1 font-mono">
                        {r.tempPassword}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="divide-y divide-white/[0.05]">
              {results.map((r) => (
                <li key={`${r.row}-${r.email}`} className="flex items-baseline gap-2 py-2 text-sm">
                  <span
                    className={
                      r.status === "created"
                        ? "text-emerald-400"
                        : r.status === "skipped"
                          ? "text-muted-foreground"
                          : "text-red-400"
                    }
                  >
                    {r.status === "created" ? "Added" : r.status === "skipped" ? "Skipped" : "Failed"}
                  </span>
                  <span className="truncate font-medium">{r.name || r.email}</span>
                  {r.message && (
                    <span className="truncate text-xs text-muted-foreground">{r.message}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={TEMPLATE}
              rows={9}
              className="input-premium rounded-xl font-mono text-xs"
              disabled={busy}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Columns: name, email, department, role. Only a Partner can import Managers.
              </span>
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foreground"
                onClick={() => setText(TEMPLATE)}
              >
                Use the example
              </button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {results ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void run()} disabled={busy || !text.trim()}>
                {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

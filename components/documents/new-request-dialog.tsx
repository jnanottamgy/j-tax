"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ListPlus, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import {
  createDocumentRequest,
  type ClientOption,
} from "@/app/actions/document-requests"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const TEMPLATES: { label: string; items: string[] }[] = [
  {
    label: "ITR (Individual)",
    items: [
      "Form 16",
      "Form 16A / TDS certificates",
      "AIS & TIS download",
      "Form 26AS",
      "Bank statements (all accounts)",
      "Capital gains statements (broker/CAMS)",
      "Rent receipts / HRA proofs",
      "80C/80D investment proofs",
    ],
  },
  {
    label: "GST Monthly",
    items: [
      "Sales register",
      "Purchase register",
      "Bank statement",
      "Debit/credit notes",
    ],
  },
  {
    label: "Audit",
    items: [
      "Trial balance",
      "Fixed asset register",
      "Bank statements & reconciliations",
      "Loan statements & sanction letters",
      "Debtor/creditor confirmations",
      "Stock/inventory statement",
    ],
  },
]

type NewRequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientOptions: ClientOption[]
}

export function NewRequestDialog({
  open,
  onOpenChange,
  clientOptions,
}: NewRequestDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [clientId, setClientId] = useState("")
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<string[]>([""])

  function reset() {
    setClientId("")
    setTitle("")
    setDueDate("")
    setNotes("")
    setItems([""])
  }

  function appendTemplate(templateItems: string[]) {
    setItems((prev) => {
      const kept = prev.filter((item) => item.trim() !== "")
      return [...kept, ...templateItems]
    })
  }

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [""]
    })
  }

  const validItems = items.map((i) => i.trim()).filter(Boolean)
  const canSubmit = Boolean(clientId) && title.trim() !== "" && validItems.length > 0

  function handleSubmit() {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await createDocumentRequest({
        clientId,
        title: title.trim(),
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        items: validItems,
      })
      if (result.success) {
        toast.success("Document request created")
        reset()
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to create document request")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="size-5 text-primary" />
            New Document Request
          </DialogTitle>
          <DialogDescription>
            Ask a client for a list of documents. They upload against each item
            from their portal; outstanding items are auto-chased by email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="req-client">Client</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={isPending}>
              <SelectTrigger id="req-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="req-title">Title</Label>
            <Input
              id="req-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. FY 2025-26 ITR documents"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="req-due">
              Due date{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="req-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="req-notes">
              Notes{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="req-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the client should know about this request"
              rows={2}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Documents to request</Label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((template) => (
                  <Button
                    key={template.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-xs"
                    onClick={() => appendTemplate(template.items)}
                    disabled={isPending}
                  >
                    + {template.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateItem(index, e.target.value)}
                    placeholder={`Item ${index + 1} — e.g. Bank statement`}
                    disabled={isPending}
                    aria-label={`Document item ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => removeItem(index)}
                    disabled={isPending}
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, ""])}
              disabled={isPending}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add item
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 btn-glow"
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create request${validItems.length > 0 ? ` (${validItems.length} item${validItems.length !== 1 ? "s" : ""})` : ""}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

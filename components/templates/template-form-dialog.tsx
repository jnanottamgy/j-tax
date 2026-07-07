"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"
import {
  createJobTemplate,
  updateJobTemplate,
  type JobTemplateListItem,
} from "@/app/actions/job-templates"
import { SERVICE_TYPE_LABELS } from "@/lib/clients/constants"

type ItemDraft = {
  key: number
  title: string
  offsetDays: string
}

type TemplateFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pass a template to edit; null/undefined creates a new one. */
  template?: JobTemplateListItem | null
  onSaved: () => void
}

const SERVICE_TYPE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS) as Array<
  [keyof typeof SERVICE_TYPE_LABELS, string]
>

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: TemplateFormDialogProps) {
  const isEdit = Boolean(template)
  const keyCounter = useRef(0)

  const nextKey = () => ++keyCounter.current

  const [name, setName] = useState("")
  const [serviceType, setServiceType] = useState<string>("GST_RETURN")
  const [description, setDescription] = useState("")
  const [items, setItems] = useState<ItemDraft[]>([])
  const [pending, setPending] = useState(false)

  // Re-initialise the form each time the dialog opens
  useEffect(() => {
    if (!open) return
    if (template) {
      setName(template.name)
      setServiceType(template.serviceType)
      setDescription(template.description ?? "")
      setItems(
        template.items.map((item) => ({
          key: nextKey(),
          title: item.title,
          offsetDays: String(item.offsetDays),
        }))
      )
    } else {
      setName("")
      setServiceType("GST_RETURN")
      setDescription("")
      setItems([{ key: nextKey(), title: "", offsetDays: "0" }])
    }
  }, [open, template])

  const addRow = () => {
    setItems((prev) => [...prev, { key: nextKey(), title: "", offsetDays: "0" }])
  }

  const removeRow = (key: number) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  const updateRow = (key: number, patch: Partial<Omit<ItemDraft, "key">>) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return

    if (!name.trim()) {
      toast.error("Enter a template name")
      return
    }
    const cleanItems = items
      .map((item) => ({
        title: item.title.trim(),
        offsetDays: Math.max(0, Number.parseInt(item.offsetDays, 10) || 0),
      }))
      .filter((item) => item.title.length > 0)
    if (cleanItems.length === 0) {
      toast.error("Add at least one checklist step")
      return
    }

    setPending(true)
    try {
      const payload = {
        name: name.trim(),
        serviceType,
        description: description.trim() || undefined,
        items: cleanItems,
      }
      const result = template
        ? await updateJobTemplate({ id: template.id, ...payload })
        : await createJobTemplate(payload)

      if (result.success) {
        toast.success(template ? "Template updated" : "Template created")
        onSaved()
        onOpenChange(false)
      } else {
        const firstFieldError = result.fieldErrors
          ? Object.values(result.fieldErrors).flat().filter(Boolean)[0]
          : undefined
        toast.error(result.error || firstFieldError || "Failed to save template")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit template" : "New job template"}</DialogTitle>
          <DialogDescription>
            Steps are copied into a task&apos;s checklist when a job is started.
            Offset = days before the job due date the step should be done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly GST Filing"
              className="input-premium h-10 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-service-type">Service type</Label>
            <select
              id="template-service-type"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="input-premium h-10 w-full rounded-xl px-3"
            >
              {SERVICE_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this workflow covers…"
              className="min-h-[64px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Checklist steps</Label>
              <span className="text-xs text-muted-foreground">
                Offset (days before due)
              </span>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <Input
                    value={item.title}
                    onChange={(e) => updateRow(item.key, { title: e.target.value })}
                    placeholder="Step title"
                    className="input-premium h-9 rounded-xl"
                    aria-label={`Step ${index + 1} title`}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={item.offsetDays}
                    onChange={(e) => updateRow(item.key, { offsetDays: e.target.value })}
                    className="input-premium h-9 w-20 shrink-0 rounded-xl text-right"
                    aria-label={`Step ${index + 1} offset days`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(item.key)}
                    aria-label={`Remove step ${index + 1}`}
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
              className="h-8 gap-1.5 rounded-xl"
              onClick={addRow}
            >
              <Plus className="size-3.5" />
              Add step
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" className="btn-glow rounded-xl" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {isEdit ? "Saving…" : "Creating…"}
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create template"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

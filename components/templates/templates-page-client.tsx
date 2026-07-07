"use client"

import { useState } from "react"
import { LayoutTemplate, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { StartJobDialog } from "@/components/templates/start-job-dialog"
import { TemplateFormDialog } from "@/components/templates/template-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Switch } from "@/components/ui/switch"
import { GlassCard } from "@/components/dashboard/glass-card"
import {
  deleteJobTemplate,
  listJobTemplates,
  seedDefaultJobTemplates,
  setTemplateActive,
  type ClientOption,
  type EmployeeOption,
  type JobTemplateListItem,
} from "@/app/actions/job-templates"
import { SERVICE_TYPE_LABELS } from "@/lib/clients/constants"

type TemplatesPageClientProps = {
  initialTemplates: JobTemplateListItem[]
  clients: ClientOption[]
  employees: EmployeeOption[]
}

export function TemplatesPageClient({
  initialTemplates,
  clients,
  employees,
}: TemplatesPageClientProps) {
  const [templates, setTemplates] = useState(initialTemplates)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<JobTemplateListItem | null>(null)
  const [startTemplate, setStartTemplate] = useState<JobTemplateListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<JobTemplateListItem | null>(null)
  const [seeding, setSeeding] = useState(false)

  const refresh = async () => {
    try {
      setTemplates(await listJobTemplates())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reload templates")
    }
  }

  const openCreate = () => {
    setEditingTemplate(null)
    setFormOpen(true)
  }

  const openEdit = (template: JobTemplateListItem) => {
    setEditingTemplate(template)
    setFormOpen(true)
  }

  const handleSeed = async () => {
    if (seeding) return
    setSeeding(true)
    try {
      const result = await seedDefaultJobTemplates()
      if (result.success) {
        toast.success(
          result.created
            ? `Seeded ${result.created} default templates`
            : "Templates already exist — nothing to seed"
        )
        await refresh()
      } else {
        toast.error(result.error || "Failed to seed templates")
      }
    } finally {
      setSeeding(false)
    }
  }

  const handleToggleActive = async (template: JobTemplateListItem, isActive: boolean) => {
    // Optimistic flip, rollback on error
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, isActive } : t))
    )
    const result = await setTemplateActive(template.id, isActive)
    if (result.success) {
      toast.success(isActive ? "Template enabled" : "Template disabled")
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, isActive: template.isActive } : t))
      )
      toast.error(result.error || "Failed to update template")
    }
  }

  const handleDeleteConfirmed = async () => {
    const target = deleteTarget
    if (!target) return
    const result = await deleteJobTemplate(target.id)
    if (result.success) {
      toast.success("Template deleted")
      setTemplates((prev) => prev.filter((t) => t.id !== target.id))
    } else {
      toast.error(result.error || "Failed to delete template")
    }
  }

  return (
    <>
      <PageHeader
        label="Standard workflows"
        title="Job templates"
        description="Reusable step-by-step checklists for recurring engagements. Start a job to create a task with its checklist pre-filled."
        action={
          templates.length > 0 ? (
            <Button
              size="sm"
              className="btn-glow h-9 gap-1.5 rounded-xl px-4"
              onClick={openCreate}
            >
              <Plus className="size-3.5" />
              New template
            </Button>
          ) : undefined
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No job templates yet"
          description="Seed the standard CA workflows (GST, TDS, ITR, audit, bookkeeping) or build your own from scratch."
          action={{
            label: seeding ? "Seeding…" : "Seed default templates",
            onClick: handleSeed,
          }}
          secondaryAction={{
            label: "Create template",
            onClick: openCreate,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <GlassCard key={template.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <h3 className="truncate font-semibold leading-snug" title={template.name}>
                    {template.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {SERVICE_TYPE_LABELS[template.serviceType]}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {template.itemCount} {template.itemCount === 1 ? "step" : "steps"}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={template.isActive}
                  onCheckedChange={(checked) => handleToggleActive(template, checked)}
                  aria-label={
                    template.isActive
                      ? `Disable ${template.name}`
                      : `Enable ${template.name}`
                  }
                />
              </div>

              {template.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {template.description}
                </p>
              )}

              <div className="mt-auto flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl"
                  disabled={!template.isActive}
                  onClick={() => setStartTemplate(template)}
                >
                  <Play className="size-3.5" />
                  Start job
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl"
                  onClick={() => openEdit(template)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(template)}
                  aria-label={`Delete ${template.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingTemplate(null)
        }}
        template={editingTemplate}
        onSaved={refresh}
      />

      {startTemplate && (
        <StartJobDialog
          open={startTemplate !== null}
          onOpenChange={(open) => !open && setStartTemplate(null)}
          template={startTemplate}
          clients={clients}
          employees={employees}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name ?? ""}"?`}
        description="The template and its steps will be permanently removed. Tasks already started from it keep their checklists."
        confirmLabel="Delete template"
        destructive
        onConfirm={handleDeleteConfirmed}
      />
    </>
  )
}

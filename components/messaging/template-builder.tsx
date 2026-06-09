"use client"

import { useState } from "react"
import { Plus, X, Save, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FormField } from "@/components/forms/form-field"
import { useValidatedForm } from "@/hooks/use-validated-form"
import type { FormActionState } from "@/lib/forms/types"
import { templateSchema } from "@/lib/validations/message"
import { cn } from "@/lib/utils"

type TemplateType = "DOCUMENT_REMINDER" | "COMPLIANCE_REMINDER" | "PAYMENT_REMINDER" | "TASK_ASSIGNMENT" | "OVERDUE_NOTIFICATION" | "CUSTOM"

interface TemplateBuilderProps {
  onSave: (template: {
    name: string
    type: TemplateType
    content: string
    variables: string[]
  }) => Promise<FormActionState>
  onCancel: () => void
  initialData?: {
    name?: string
    type?: TemplateType
    content?: string
    variables?: string[]
  }
  isSaving?: boolean
}

const TEMPLATE_TYPES: { value: TemplateType; label: string; color: string }[] = [
  { value: "DOCUMENT_REMINDER", label: "Document Reminder", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "COMPLIANCE_REMINDER", label: "Compliance Reminder", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "PAYMENT_REMINDER", label: "Payment Reminder", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { value: "TASK_ASSIGNMENT", label: "Task Assignment", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "OVERDUE_NOTIFICATION", label: "Overdue Notification", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "CUSTOM", label: "Custom", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
]

const AVAILABLE_VARIABLES = [
  { name: "client_name", label: "Client Name", example: "Acme Corporation" },
  { name: "client_code", label: "Client Code", example: "CLI-001" },
  { name: "due_date", label: "Due Date", example: "January 31, 2026" },
  { name: "document_name", label: "Document Name", example: "GSTR-1 Return" },
  { name: "amount", label: "Amount", example: "₹50,000" },
  { name: "task_title", label: "Task Title", example: "Complete audit report" },
  { name: "assigned_employee", label: "Assigned Employee", example: "John Doe" },
]

export function TemplateBuilder({
  onSave,
  onCancel,
  initialData,
  isSaving = false,
}: TemplateBuilderProps) {
  const [name, setName] = useState(initialData?.name || "")
  const [type, setType] = useState<TemplateType>(initialData?.type || "CUSTOM")
  const [content, setContent] = useState(initialData?.content || "")
  const [variables, setVariables] = useState<string[]>(initialData?.variables || [])
  const [newVariable, setNewVariable] = useState("")

  const handleAddVariable = () => {
    if (newVariable && !variables.includes(newVariable)) {
      setVariables([...variables, newVariable])
      setNewVariable("")
    }
  }

  const handleRemoveVariable = (variable: string) => {
    setVariables(variables.filter((v) => v !== variable))
  }

  const handleInsertVariable = (variableName: string) => {
    setContent((prev) => prev + `{{${variableName}}}`)
  }

  const { submit, getError, isPending } = useValidatedForm({
    schema: templateSchema,
    validationErrorMessage: "Template name and content are required.",
    successMessage: "Template created successfully",
    onSuccess: onCancel,
    onSubmit: async (data) =>
      onSave({
        name: data.name,
        type: data.type as TemplateType,
        content: data.content,
        variables: data.variables ?? variables,
      }),
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving || isPending) return
    submit({ name, type, content, variables })
  }

  const selectedType = TEMPLATE_TYPES.find((t) => t.value === type)

  return (
    <Card className="bg-white/[0.02] border-white/[0.08] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Message Template Builder</h3>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6" noValidate>
        <FormField
          label="Template Name"
          htmlFor="template-name"
          required
          error={getError("name")}
        >
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Monthly GST Reminder"
            disabled={isSaving || isPending}
            aria-invalid={!!getError("name")}
          />
        </FormField>

        {/* Template Type */}
        <div className="space-y-2">
          <Label htmlFor="template-type">Template Type</Label>
          <select
            id="template-type"
            value={type}
            onChange={(e) => setType(e.target.value as TemplateType)}
            className="w-full h-10 rounded-md border border-white/[0.12] bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
          >
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <FormField
          label="Message Content"
          htmlFor="template-content"
          required
          error={getError("content")}
        >
          <div className="relative">
            <Textarea
              id="template-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your message content. Use {{variable_name}} for dynamic values."
              rows={6}
              className="resize-none"
              disabled={isSaving || isPending}
              aria-invalid={!!getError("content")}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {content.length} characters
            </div>
          </div>
        </FormField>

        {/* Available Variables */}
        <div className="space-y-2">
          <Label>Available Variables</Label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map((variable) => (
              <Button
                key={variable.name}
                variant="outline"
                size="sm"
                onClick={() => handleInsertVariable(variable.name)}
                disabled={isSaving}
                className="h-7 text-xs"
              >
                + {variable.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Variables Used */}
        <div className="space-y-2">
          <Label>Variables Used</Label>
          <div className="flex flex-wrap gap-2">
            {variables.length === 0 ? (
              <span className="text-sm text-muted-foreground">No variables selected</span>
            ) : (
              variables.map((variable) => (
                <Badge key={variable} variant="secondary" className="gap-1">
                  {variable}
                  <button
                    onClick={() => handleRemoveVariable(variable)}
                    className="ml-1 hover:text-destructive"
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Custom Variable Input */}
        <div className="space-y-2">
          <Label>Add Custom Variable</Label>
          <div className="flex gap-2">
            <Input
              value={newVariable}
              onChange={(e) => setNewVariable(e.target.value)}
              placeholder="variable_name"
              onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
              disabled={isSaving}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddVariable}
              disabled={isSaving || !newVariable.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        {content && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-4">
              <div className="text-sm whitespace-pre-wrap">{content}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving || isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || !content.trim() || isSaving || isPending}
            className="flex-1 btn-glow"
          >
            {isSaving || isPending ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}

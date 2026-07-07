"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Check, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import type { ServiceFrequency, ServiceType } from "@prisma/client"

import {
  updateClient,
  type ClientActionState,
} from "@/app/actions/clients"
import {
  createGroup,
  getClientMasterData,
  listGroups,
  updateClientMasterData,
  type GroupListItem,
  type MasterDataInput,
} from "@/app/actions/contacts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ALL_CLIENT_PRIORITIES,
  ALL_CLIENT_STATUSES,
  ALL_SERVICE_TYPES,
  CLIENT_PRIORITY_LABELS,
  CLIENT_STATUS_LABELS,
  SERVICE_FREQUENCY_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/clients/constants"
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
} from "@/lib/clients/master-data"
import type { ClientListItem, EmployeeOption } from "@/lib/clients/types"
import { cn } from "@/lib/utils"

const initialState: ClientActionState = {}

type ServiceCfg = { frequency: ServiceFrequency; customName: string }
const FREQUENCIES = Object.keys(SERVICE_FREQUENCY_LABELS) as ServiceFrequency[]

type EditClientDialogProps = {
  client: ClientListItem
  employees: EmployeeOption[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function EditClientDialog({
  client,
  employees,
  open,
  onOpenChange,
  onSuccess,
  trigger,
}: EditClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const actualOpen = open ?? internalOpen
  const setActualOpen = onOpenChange ?? setInternalOpen
  const [state, formAction, isPending] = useActionState(
    updateClient,
    initialState
  )

  // Editable services — seeded from the client's current service mix.
  const [services, setServices] = useState<Partial<Record<ServiceType, ServiceCfg>>>(
    () =>
      Object.fromEntries(
        (client.services ?? []).map((s) => [
          s.type,
          { frequency: s.frequency, customName: s.customName ?? "" },
        ])
      )
  )
  const toggleService = (t: ServiceType) =>
    setServices((prev) => {
      const next = { ...prev }
      if (next[t]) delete next[t]
      else next[t] = { frequency: "MONTHLY", customName: "" }
      return next
    })
  const setServiceCfg = (t: ServiceType, patch: Partial<ServiceCfg>) =>
    setServices((prev) => ({
      ...prev,
      [t]: {
        frequency: prev[t]?.frequency ?? "MONTHLY",
        customName: prev[t]?.customName ?? "",
        ...patch,
      },
    }))

  const servicesPayload = useMemo(
    () =>
      (Object.entries(services) as [ServiceType, ServiceCfg][]).map(
        ([serviceType, c]) => ({
          serviceType,
          frequency: c.frequency,
          customName:
            serviceType === "OTHER" ? c.customName.trim() || undefined : undefined,
        })
      ),
    [services]
  )
  const servicesJson = JSON.stringify(servicesPayload)
  const selectedCount = servicesPayload.length
  const otherMissingName = Boolean(services.OTHER && !services.OTHER.customName.trim())

  useEffect(() => {
    if (!state.success && !state.error) return

    if (state.success) {
      toast.success("Client updated", {
        description: "The master client record is now current.",
      })
      const timer = window.setTimeout(() => {
        setActualOpen(false)
        onSuccess?.()
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (state.error) {
      toast.error(state.error)
    }
  }, [state, setActualOpen, onSuccess])

  return (
    <Dialog open={actualOpen} onOpenChange={setActualOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="input-premium h-9 rounded-xl">
            <Pencil className="size-3.5" />
            Edit client
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92vh] overflow-hidden border-white/[0.08] bg-popover/95 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:max-w-2xl">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl font-semibold tracking-tight">
              Edit client
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              Maintain the central client profile used by compliance, payments,
              documents, and work tracking.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          action={formAction}
          onSubmit={(e) => {
            if (selectedCount === 0) {
              e.preventDefault()
              toast.error("Select at least one service.")
              return
            }
            if (otherMissingName) {
              e.preventDefault()
              toast.error('Name the "Other" service before saving.')
            }
          }}
          className="overflow-y-auto px-6 py-5"
        >
          <input type="hidden" name="id" value={client.id} />
          <input type="hidden" name="services" value={servicesJson} />
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <section className="space-y-4">
              <h3 className="label-premium">Client identity</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Client name"
                  name="name"
                  required
                  error={state.fieldErrors?.name?.[0]}
                  className="sm:col-span-2"
                >
                  <Input
                    id="name"
                    name="name"
                    defaultValue={client.name}
                    className="input-premium h-10 rounded-xl"
                    required
                    disabled={isPending}
                  />
                </Field>
                <ReadOnlyField label="Client code" value={client.code} />
                <Field
                  label="Status"
                  name="status"
                  error={state.fieldErrors?.status?.[0]}
                >
                  <select
                    id="status"
                    name="status"
                    defaultValue={client.status}
                    disabled={isPending}
                    className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                  >
                    {ALL_CLIENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {CLIENT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="GSTIN" name="gstin" error={state.fieldErrors?.gstin?.[0]}>
                  <Input
                    id="gstin"
                    name="gstin"
                    defaultValue={client.gstin ?? ""}
                    className="input-premium h-10 rounded-xl font-mono text-sm uppercase"
                    disabled={isPending}
                  />
                </Field>
                <Field label="PAN" name="pan" error={state.fieldErrors?.pan?.[0]}>
                  <Input
                    id="pan"
                    name="pan"
                    defaultValue={client.pan ?? ""}
                    className="input-premium h-10 rounded-xl font-mono text-sm uppercase"
                    disabled={isPending}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="label-premium">Contact</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" name="email" error={state.fieldErrors?.email?.[0]}>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={client.email ?? ""}
                    className="input-premium h-10 rounded-xl"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Phone" name="phone">
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={client.phone ?? ""}
                    className="input-premium h-10 rounded-xl"
                    disabled={isPending}
                  />
                </Field>
                <Field label="WhatsApp" name="whatsapp">
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    defaultValue={client.whatsapp ?? ""}
                    className="input-premium h-10 rounded-xl"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Priority" name="priority">
                  <select
                    id="priority"
                    name="priority"
                    defaultValue={client.priority}
                    disabled={isPending}
                    className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                  >
                    {ALL_CLIENT_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {CLIENT_PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Address" name="address" className="sm:col-span-2">
                  <Textarea
                    id="address"
                    name="address"
                    defaultValue={client.address ?? ""}
                    className="input-premium min-h-[80px] rounded-xl"
                    disabled={isPending}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="label-premium">Assignment</h3>
              <Field label="Assigned employee" name="assignedEmployeeId">
                <select
                  id="assignedEmployeeId"
                  name="assignedEmployeeId"
                  defaultValue={client.assignedEmployeeId ?? ""}
                  disabled={isPending}
                  className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                      {employee.department ? ` - ${employee.department}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="label-premium">Services</h3>
                <span className="text-xs text-muted-foreground">
                  {selectedCount} selected
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Toggle the services this client subscribes to and set each filing cycle.
                Adding a service starts its compliance tracking; removing one stops it.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {ALL_SERVICE_TYPES.map((serviceType) => {
                  const cfg = services[serviceType]
                  const on = Boolean(cfg)
                  return (
                    <div
                      key={serviceType}
                      className={cn(
                        "rounded-xl border p-3 transition-colors",
                        on
                          ? "border-primary/30 bg-primary/[0.07]"
                          : "border-white/[0.08] bg-white/[0.02]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleService(serviceType)}
                        disabled={isPending}
                        aria-pressed={on}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <span className="text-sm font-medium">
                          {SERVICE_TYPE_LABELS[serviceType]}
                        </span>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            on
                              ? "border-primary/40 bg-primary text-primary-foreground"
                              : "border-white/[0.15] bg-white/[0.03]"
                          )}
                        >
                          {on && <Check className="size-3.5" />}
                        </span>
                      </button>

                      {on && (
                        <div className="mt-3 space-y-2">
                          {serviceType === "OTHER" && (
                            <Input
                              value={cfg?.customName ?? ""}
                              onChange={(e) =>
                                setServiceCfg("OTHER", { customName: e.target.value })
                              }
                              placeholder="Name the service (e.g. Trademark filing)"
                              maxLength={120}
                              disabled={isPending}
                              aria-invalid={!cfg?.customName?.trim()}
                              className="input-premium h-9 rounded-lg text-sm"
                            />
                          )}
                          <select
                            value={cfg?.frequency ?? "MONTHLY"}
                            onChange={(e) =>
                              setServiceCfg(serviceType, {
                                frequency: e.target.value as ServiceFrequency,
                              })
                            }
                            disabled={isPending}
                            className="input-premium h-9 w-full rounded-lg px-3 text-sm"
                          >
                            {FREQUENCIES.map((f) => (
                              <option key={f} value={f}>
                                {SERVICE_FREQUENCY_LABELS[f]}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {selectedCount === 0 && (
                <p className="text-xs text-amber-400">
                  Select at least one service to keep compliance tracking active.
                </p>
              )}
              {otherMissingName && (
                <p className="text-xs text-amber-400">
                  Enter a name for the &quot;Other&quot; service.
                </p>
              )}
            </section>

            <section className="space-y-4">
              <h3 className="label-premium">Notes</h3>
              <Textarea
                name="notes"
                defaultValue={client.notes ?? ""}
                className="input-premium min-h-[88px] rounded-xl"
                disabled={isPending}
              />
            </section>
          </motion.div>

          <div className="mt-8 flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActualOpen(false)}
              disabled={isPending}
              className="input-premium h-10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="btn-glow h-10 rounded-xl px-6"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  name,
  required,
  error,
  className,
  children,
}: {
  label: string
  name?: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name} className="text-[13px]">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px]">{label}</Label>
      <div className="input-premium flex h-10 items-center rounded-xl px-3 font-mono text-sm text-muted-foreground">
        {value}
      </div>
    </div>
  )
}

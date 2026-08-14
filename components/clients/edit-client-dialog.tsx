"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Check, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import type { ClientStatus, ServiceFrequency, ServiceType } from "@prisma/client"

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
  CLIENT_STATUS_MEANING,
  SERVICE_FREQUENCY_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/clients/constants"
import {
  CLIENT_TYPE_OPTIONS,
  ENTITY_TYPE_LABELS,
} from "@/lib/clients/master-data"
import {
  MONTH_NAMES,
  indicateTaxAudit,
  resolveGstScheme,
} from "@/lib/compliance/gst-scheme"
import { deriveClientFields, entityTypeLabelFromPan } from "@/lib/clients/derive"
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
  const [clientType, setClientType] = useState(client.clientType ?? "")
  const [status, setStatus] = useState<ClientStatus>(client.status)
  // Uncontrolled inputs elsewhere in this form, but these three interlock: a
  // GSTIN carries the PAN and the state, and a PAN encodes the constitution.
  const [gstin, setGstin] = useState(client.gstin ?? "")
  const [pan, setPan] = useState(client.pan ?? "")
  const panEntityLabel = entityTypeLabelFromPan(pan)
  const derivedFromGstin = deriveClientFields({ gstin, pan, clientType })
  // Live, so the partner sees the consequence of the number as they type it
  // rather than discovering it when the wrong returns appear.
  const [turnover, setTurnover] = useState(
    client.annualTurnover != null ? String(client.annualTurnover) : ""
  )
  const turnoverNum = turnover.trim() ? Number(turnover) : null
  const gstHint = resolveGstScheme({
    explicit: client.gstFilingScheme,
    annualTurnover: turnoverNum,
  }).reason
  const audit = indicateTaxAudit({ annualTurnover: turnoverNum })
  const auditHint =
    audit.likely || audit.checkCashRatio ? `Tax audit: ${audit.reason}` : ""
  const [isIncorporated, setIsIncorporated] = useState(client.isIncorporated ?? true)

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

  // Radix unmounts the dialog body on close, so the uncontrolled inputs reseed
  // from `client` on each open — but this state lives outside the portal and
  // would otherwise persist. Without the reset, cancelling an edit and
  // reopening shows the discarded service toggles as if they were saved.
  useEffect(() => {
    if (!actualOpen) return
    setClientType(client.clientType ?? "")
    setStatus(client.status)
    setGstin(client.gstin ?? "")
    setPan(client.pan ?? "")
    setIsIncorporated(client.isIncorporated ?? true)
    setServices(
      Object.fromEntries(
        (client.services ?? []).map((s) => [
          s.type,
          { frequency: s.frequency, customName: s.customName ?? "" },
        ])
      )
    )
  }, [actualOpen, client])

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
      {/* grid-rows pins the header and gives the form the remaining height.
          Without an explicit `minmax(0,…)` track the form keeps grid's default
          `min-height:auto`, refuses to shrink, grows past the max-height, and
          `overflow-hidden` then clips its footer — leaving Save unreachable. */}
      <DialogContent className="grid max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-white/[0.08] bg-popover/95 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:max-w-2xl">
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
          className="min-h-0 overflow-y-auto px-6 py-5"
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
                <Field label="Company name" name="companyName" error={state.fieldErrors?.companyName?.[0]}>
                  <Input
                    id="companyName"
                    name="companyName"
                    defaultValue={client.companyName ?? ""}
                    placeholder="Registered legal name (if different)"
                    className="input-premium h-10 rounded-xl"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Client type" name="clientType" error={state.fieldErrors?.clientTypeCustom?.[0]}>
                  <select
                    id="clientType"
                    name="clientType"
                    value={clientType}
                    onChange={(e) => setClientType(e.target.value)}
                    disabled={isPending}
                    className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                  >
                    <option value="">Select type…</option>
                    {CLIENT_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {ENTITY_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  {clientType === "OTHER" && (
                    <Input
                      name="clientTypeCustom"
                      defaultValue={client.clientTypeCustom ?? ""}
                      placeholder="Enter the client type"
                      className="input-premium mt-2 h-10 rounded-xl"
                      disabled={isPending}
                    />
                  )}
                </Field>
                <Field label="Incorporation status">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={isIncorporated}
                      onChange={(e) => setIsIncorporated(e.target.checked)}
                      disabled={isPending}
                      className="size-4 rounded border-white/20 accent-primary"
                    />
                    <span className="text-muted-foreground">
                      {isIncorporated ? "Already incorporated" : "Not yet incorporated"}
                    </span>
                  </label>
                  <input type="hidden" name="isIncorporated" value={isIncorporated ? "true" : "false"} />
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
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ClientStatus)}
                    disabled={isPending}
                    className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                  >
                    {ALL_CLIENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {CLIENT_STATUS_LABELS[s]}
                        {CLIENT_STATUS_MEANING[s].generatesFilings ? "" : " — no filings"}
                      </option>
                    ))}
                  </select>
                  {/* The consequence, at the moment of choosing. Three of the
                      four statuses stop automatic compliance, and the chip
                      alone never said so. */}
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      CLIENT_STATUS_MEANING[status].generatesFilings
                        ? "text-muted-foreground"
                        : "text-amber-400"
                    )}
                  >
                    {CLIENT_STATUS_MEANING[status].consequence}
                  </p>
                </Field>
                <Field label="GSTIN" name="gstin" error={state.fieldErrors?.gstin?.[0]}>
                  <Input
                    id="gstin"
                    name="gstin"
                    value={gstin}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase()
                      setGstin(next)
                      // Fill only what is empty — a typed value is a decision,
                      // and a GSTIN/PAN can legitimately disagree mid-restructure.
                      const d = deriveClientFields({ gstin: next, pan, clientType })
                      if (d.pan) setPan(d.pan)
                      if (d.clientType) setClientType(d.clientType)
                    }}
                    className="input-premium h-10 rounded-xl font-mono text-sm uppercase"
                    disabled={isPending}
                  />
                  {derivedFromGstin.stateCode && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Place of supply {derivedFromGstin.stateCode} — taken from the GSTIN.
                    </p>
                  )}
                </Field>
                <Field label="PAN" name="pan" error={state.fieldErrors?.pan?.[0]}>
                  <Input
                    id="pan"
                    name="pan"
                    value={pan}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase()
                      setPan(next)
                      const d = deriveClientFields({ gstin, pan: next, clientType })
                      if (d.clientType) setClientType(d.clientType)
                    }}
                    className="input-premium h-10 rounded-xl font-mono text-sm uppercase"
                    disabled={isPending}
                  />
                  {panEntityLabel && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      PAN says: {panEntityLabel}
                    </p>
                  )}
                </Field>
              </div>
            </section>

            {/* Accounting year and scale. These are not paperwork: turnover
                decides whether the client files GST monthly or quarterly, and
                the year end decides when their books actually close. */}
            <section className="space-y-4">
              <h3 className="label-premium">Year end &amp; scale</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Books close at end of" name="fyEndMonth">
                  <select
                    id="fyEndMonth"
                    name="fyEndMonth"
                    defaultValue={String(client.fyEndMonth ?? 3)}
                    className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                    disabled={isPending}
                  >
                    {MONTH_NAMES.map((label, i) => (
                      <option key={label} value={i + 1}>
                        {label}
                        {i === 2 ? " (standard Indian FY)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Indian tax deadlines stay on April–March by law; this is the
                    client&apos;s own accounting year.
                  </p>
                </Field>

                <Field label="GST filing" name="gstFilingScheme">
                  <select
                    id="gstFilingScheme"
                    name="gstFilingScheme"
                    defaultValue={client.gstFilingScheme ?? ""}
                    className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                    disabled={isPending}
                  >
                    <option value="">Decide from turnover</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QRMP">Quarterly (QRMP)</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {gstHint}
                  </p>
                </Field>

                <Field label="Annual turnover (₹)" name="annualTurnover">
                  <Input
                    id="annualTurnover"
                    name="annualTurnover"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={client.annualTurnover ?? ""}
                    onChange={(e) => setTurnover(e.target.value)}
                    placeholder="Not recorded"
                    className="input-premium h-10 rounded-xl tabular-nums"
                    disabled={isPending}
                  />
                </Field>

                <Field label="Turnover is for FY" name="turnoverFy">
                  <Input
                    id="turnoverFy"
                    name="turnoverFy"
                    defaultValue={client.turnoverFy ?? ""}
                    placeholder="2024-25"
                    className="input-premium h-10 rounded-xl"
                    disabled={isPending}
                  />
                </Field>
              </div>
              {auditHint && (
                <p className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs text-muted-foreground">
                  {auditHint}
                </p>
              )}
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

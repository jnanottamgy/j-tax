"use client"

/**
 * Choosing what someone can see.
 *
 * The role field was a three-option dropdown with no explanation, which made
 * the highest-consequence decision in the app also the least informed one — an
 * Employee sees only their own clients and no fees at all, a Manager sees every
 * client's billing, and nothing on screen said so.
 *
 * The consequences are shown for whatever is selected, not hidden behind a
 * tooltip, because this is chosen once and lived with.
 */

import { Check, X } from "lucide-react"

import { ROLE_CAPABILITIES, ROLE_LABELS } from "@/lib/auth/roles"
import { cn } from "@/lib/utils"

export type StaffRole = "EMPLOYEE" | "MANAGER"

export function RolePicker({
  value,
  onChange,
  /** Only a Partner may create a Manager, so the option is hidden otherwise. */
  canGrantManager,
  disabled,
  id = "role",
}: {
  value: StaffRole
  onChange: (role: StaffRole) => void
  canGrantManager: boolean
  disabled?: boolean
  id?: string
}) {
  const options: StaffRole[] = canGrantManager ? ["EMPLOYEE", "MANAGER"] : ["EMPLOYEE"]
  const caps = ROLE_CAPABILITIES[value]

  return (
    <div className="space-y-2">
      <div className="flex gap-2" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((role) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={value === role}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
              value === role
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04]"
            )}
          >
            <span className="font-medium">{ROLE_LABELS[role]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="text-xs font-medium text-foreground">{caps.summary}</p>
        <ul className="mt-2 space-y-1">
          {caps.grants.map((g) => (
            <li key={g} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-emerald-400" aria-hidden />
              {g}
            </li>
          ))}
          {caps.withheld.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <X className="mt-0.5 size-3 shrink-0 text-amber-400" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      </div>

      {!canGrantManager && (
        <p className="text-[11px] text-muted-foreground">
          Only a Partner can add a Manager.
        </p>
      )}
    </div>
  )
}

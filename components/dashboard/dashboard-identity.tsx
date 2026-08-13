import { Building2 } from "lucide-react"

import { getFirmSettings } from "@/lib/firm-settings"
import { ROLE_LABELS } from "@/lib/auth/roles"
import type { AppRole } from "@/lib/auth/types"
import { cn } from "@/lib/utils"

/**
 * Who you are and which firm you are in.
 *
 * Both matter more here than on a single-tenant tool: staff move between roles,
 * and a partner demoing the product or an accountant covering two practices
 * needs to know at a glance which workspace they are looking at before they
 * act on anything in it.
 *
 * Rendered in the dashboard header's action slot, so it sits opposite the
 * page title without competing with it.
 */

const ROLE_TONE: Record<AppRole, string> = {
  PARTNER: "border-primary/30 bg-primary/10 text-primary",
  MANAGER: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  EMPLOYEE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  CLIENT: "border-white/[0.12] bg-white/[0.04] text-muted-foreground",
}

export async function DashboardIdentity({
  name,
  role,
}: {
  name: string
  role: AppRole
}) {
  const firm = await getFirmSettings()

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Building2 className="size-4" />
      </div>
      <div className="min-w-0">
        {/* Firm first: the workspace you are acting inside. */}
        <p className="truncate text-[13px] font-medium leading-tight" title={firm.firmName}>
          {firm.firmName}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{name}</span>
          <span aria-hidden>·</span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-px text-[10px] font-medium tracking-wide",
              ROLE_TONE[role]
            )}
          >
            {ROLE_LABELS[role]}
          </span>
        </p>
      </div>
    </div>
  )
}

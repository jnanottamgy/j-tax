"use client"

import { ClientOnboardingWizard } from "@/components/clients/client-onboarding-wizard"
import type { EmployeeOption } from "@/lib/clients/types"

type AddClientDialogProps = {
  employees: EmployeeOption[]
  onSuccess?: () => void
  /** Open the wizard immediately (deep links like /clients?new=1) */
  defaultOpen?: boolean
}

export function AddClientDialog(props: AddClientDialogProps) {
  return <ClientOnboardingWizard {...props} />
}

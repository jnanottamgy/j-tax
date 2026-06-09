"use client"

import { ClientOnboardingWizard } from "@/components/clients/client-onboarding-wizard"
import type { EmployeeOption } from "@/lib/clients/types"

type AddClientDialogProps = {
  employees: EmployeeOption[]
  onSuccess?: () => void
}

export function AddClientDialog(props: AddClientDialogProps) {
  return <ClientOnboardingWizard {...props} />
}

"use client"

/**
 * The way back into setup after "Finish later".
 *
 * Dismissing the wizard used to be a one-way door: the flag said "onboarding
 * complete", the wizard never reappeared, and nothing told the partner that
 * Settings was now the only place to enter their firm details, logo, and bank
 * account. This card sits on the partner dashboard until the wizard is
 * actually finished, and puts them back on the step they stopped at.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Rocket } from "lucide-react"

import { Button } from "@/components/ui/button"
import { resumeOnboarding } from "@/app/actions/onboarding"

const STEP_NAMES = [
  "Firm information",
  "Firm information",
  "Add employees",
  "Add services",
  "Add your first client",
  "Email & notifications",
  "Ready to launch",
]

export function FinishSetupCard({ step }: { step: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  const nextStep = Math.min(Math.max(step, 1), STEP_NAMES.length - 1)
  const remaining = 6 - nextStep + 1

  function handleResume() {
    setError("")
    startTransition(async () => {
      const result = await resumeOnboarding()
      if (!result.success) {
        setError(result.error ?? "Could not open setup.")
        return
      }
      // The wizard lives in the app layout, gated on the flag we just cleared.
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Rocket className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Finish setting up your firm</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            You stopped at <span className="text-foreground">{STEP_NAMES[nextStep]}</span> —{" "}
            {remaining} step{remaining === 1 ? "" : "s"} left. Your logo, bank details, and sender
            email all live here; invoices and client emails look unfinished until they are set.
          </p>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <Button onClick={handleResume} disabled={pending} className="shrink-0 gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Resume setup
        {!pending && <ArrowRight className="size-4" />}
      </Button>
    </div>
  )
}

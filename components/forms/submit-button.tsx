"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SubmitButtonProps = {
  isPending: boolean
  pendingLabel: string
  label: string
  className?: string
  disabled?: boolean
}

export function SubmitButton({
  isPending,
  pendingLabel,
  label,
  className,
  disabled,
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled || isPending}
      className={cn("btn-glow h-10 rounded-xl", className)}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  )
}

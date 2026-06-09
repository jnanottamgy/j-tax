"use client"

import { cn } from "@/lib/utils"

type FormAlertProps = {
  message: string
  className?: string
}

export function FormAlert({ message, className }: FormAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className
      )}
    >
      {message}
    </div>
  )
}

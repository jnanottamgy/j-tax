"use client"

import { Children, cloneElement, isValidElement } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FormFieldProps = {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  className,
  children,
}: FormFieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined

  // When there's an error, programmatically link it to the control so screen
  // readers announce it (WCAG 3.3.1). We clone the single child field to add
  // aria-describedby / aria-invalid without changing any call site.
  let field = children
  if (error && errorId) {
    const arr = Children.toArray(children)
    const idx = arr.findIndex(
      (c) => isValidElement(c) && (c.type === "input" || typeof c.type !== "string" || c.type === "select" || c.type === "textarea")
    )
    if (idx !== -1 && isValidElement(arr[idx])) {
      const el = arr[idx] as React.ReactElement<Record<string, unknown>>
      const existing = el.props["aria-describedby"]
      arr[idx] = cloneElement(el, {
        "aria-describedby": existing ? `${existing} ${errorId}` : errorId,
        "aria-invalid": true,
      })
      field = arr
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {field}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}

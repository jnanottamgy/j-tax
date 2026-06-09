"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import type { ZodType } from "zod"
import { toast } from "sonner"

import type { FormActionState } from "@/lib/forms/types"
import { flattenFieldErrors, zodErrorToFieldMap } from "@/lib/forms/errors"

type UseValidatedFormOptions<T> = {
  schema: ZodType<T>
  onSubmit: (data: T) => Promise<FormActionState>
  successMessage?: string
  validationErrorMessage?: string
  onSuccess?: () => void
}

/**
 * Client-side Zod validation + server action submission with duplicate-submit guard,
 * inline field errors, and success/failure toasts.
 */
export function useValidatedForm<T>({
  schema,
  onSubmit,
  successMessage = "Saved successfully",
  validationErrorMessage = "Please correct the highlighted fields.",
  onSuccess,
}: UseValidatedFormOptions<T>) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [isPending, startTransition] = useTransition()
  const inFlightRef = useRef(false)

  const clearErrors = useCallback(() => {
    setFieldErrors({})
    setFormError(undefined)
  }, [])

  const getError = useCallback(
    (field: string) => fieldErrors[field],
    [fieldErrors]
  )

  const submit = useCallback(
    (data: unknown) => {
      if (inFlightRef.current || isPending) return

      setFormError(undefined)
      setFieldErrors({})

      const parsed = schema.safeParse(data)
      if (!parsed.success) {
        const mapped = zodErrorToFieldMap(parsed.error)
        setFieldErrors(mapped)
        toast.error(validationErrorMessage)
        return
      }

      inFlightRef.current = true
      startTransition(async () => {
        try {
          const result = await onSubmit(parsed.data)
          if (result.success) {
            toast.success(successMessage)
            clearErrors()
            onSuccess?.()
          } else if (result.fieldErrors) {
            setFieldErrors(flattenFieldErrors(result.fieldErrors))
            toast.error(validationErrorMessage)
          } else {
            const message = result.error ?? "Something went wrong. Please try again."
            setFormError(message)
            toast.error(message)
          }
        } catch {
          const message = "Something went wrong. Please try again."
          setFormError(message)
          toast.error(message)
        } finally {
          inFlightRef.current = false
        }
      })
    },
    [
      schema,
      onSubmit,
      successMessage,
      validationErrorMessage,
      onSuccess,
      clearErrors,
      isPending,
    ]
  )

  return {
    submit,
    fieldErrors,
    formError,
    isPending,
    getError,
    clearErrors,
    setFieldErrors,
    setFormError,
  }
}

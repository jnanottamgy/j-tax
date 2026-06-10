"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { updatePassword } from "@/app/actions/auth"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SubmitButton } from "@/components/forms/submit-button"
import { Input } from "@/components/ui/input"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { newPasswordSchema } from "@/lib/validations/auth"

const emptyForm = {
  password: "",
  confirmPassword: "",
}

export function UpdatePasswordForm() {
  const router = useRouter()
  const [formData, setFormData] = useState(emptyForm)

  const { submit, getError, isPending, formError, clearErrors: _clearErrors } = useValidatedForm({
    schema: newPasswordSchema,
    successMessage: "Password updated successfully!",
    validationErrorMessage: "Please correct the highlighted fields.",
    onSuccess: () => {
      router.push("/login?password=updated")
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("password", data.password)
      fd.set("confirmPassword", data.confirmPassword)
      return updatePassword({}, fd)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  const canSubmit =
    formData.password.length >= 8 &&
    formData.password === formData.confirmPassword

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && <FormAlert message={formError} />}

      <FormField label="New Password" htmlFor="password" required error={getError("password")}>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="••••••••"
          className="input-premium h-10 rounded-xl"
          disabled={isPending}
          aria-invalid={!!getError("password")}
        />
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Must be at least 8 characters with uppercase, lowercase, number, and special character
        </p>
      </FormField>

      <FormField
        label="Confirm New Password"
        htmlFor="confirmPassword"
        required
        error={getError("confirmPassword")}
      >
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          placeholder="••••••••"
          className="input-premium h-10 rounded-xl"
          disabled={isPending}
          aria-invalid={!!getError("confirmPassword")}
        />
      </FormField>

      <SubmitButton
        isPending={isPending}
        pendingLabel="Updating password..."
        label="Update password"
        className="w-full h-10 rounded-xl"
        disabled={!canSubmit}
      />
    </form>
  )
}

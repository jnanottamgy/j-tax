"use client"

import { useState } from "react"

import { resetPassword } from "@/app/actions/auth"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SubmitButton } from "@/components/forms/submit-button"
import { Input } from "@/components/ui/input"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { resetPasswordSchema } from "@/lib/validations/auth"

const emptyForm = {
  email: "",
}

export function ResetPasswordForm() {
  const [formData, setFormData] = useState(emptyForm)

  const { submit, getError, isPending, formError, clearErrors: _clearErrors } = useValidatedForm({
    schema: resetPasswordSchema,
    successMessage: "Password reset link sent to your email!",
    validationErrorMessage: "Please correct the highlighted fields.",
    onSuccess: () => {
      setFormData(emptyForm)
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("email", data.email)
      return resetPassword({}, fd)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && <FormAlert message={formError} />}

      <FormField label="Email" htmlFor="email" required error={getError("email")}>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
          className="input-premium h-10 rounded-xl"
          disabled={isPending}
          aria-invalid={!!getError("email")}
        />
      </FormField>

      <SubmitButton
        isPending={isPending}
        pendingLabel="Sending reset link..."
        label="Send reset link"
        className="w-full h-10 rounded-xl"
      />
    </form>
  )
}

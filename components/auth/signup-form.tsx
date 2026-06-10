"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { signUp } from "@/app/actions/auth"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SubmitButton } from "@/components/forms/submit-button"
import { Input } from "@/components/ui/input"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { signupSchema } from "@/lib/validations/auth"

const emptyForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
}

export function SignUpForm() {
  const router = useRouter()
  const [formData, setFormData] = useState(emptyForm)

  const { submit, getError, isPending, formError, clearErrors: _clearErrors } = useValidatedForm({
    schema: signupSchema,
    successMessage: "Account created successfully!",
    validationErrorMessage: "Please correct the highlighted fields.",
    onSuccess: () => {
      router.push("/login?signup=success")
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("email", data.email)
      fd.set("password", data.password)
      fd.set("name", data.name)
      fd.set("confirmPassword", data.confirmPassword)
      return signUp({}, fd)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  const canSubmit =
    formData.name.trim().length >= 2 &&
    formData.email.trim().length > 0 &&
    formData.password.length >= 8 &&
    formData.password === formData.confirmPassword

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && <FormAlert message={formError} />}

      <FormField label="Full Name" htmlFor="name" required error={getError("name")}>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Doe"
          className="input-premium h-10 rounded-xl"
          disabled={isPending}
          aria-invalid={!!getError("name")}
        />
      </FormField>

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

      <FormField label="Password" htmlFor="password" required error={getError("password")}>
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
        label="Confirm Password"
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
        pendingLabel="Creating account..."
        label="Create account"
        className="w-full h-10 rounded-xl"
        disabled={!canSubmit}
      />
    </form>
  )
}

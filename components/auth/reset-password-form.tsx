"use client"

import { useState } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"

import { resetPassword } from "@/app/actions/auth"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { resetPasswordSchema } from "@/lib/validations/auth"

const emptyForm = {
  email: "",
}

export function ResetPasswordForm() {
  const [formData, setFormData] = useState(emptyForm)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const { submit, getError, isPending, formError, clearErrors: _clearErrors } = useValidatedForm({
    schema: resetPasswordSchema,
    successMessage: "Password reset link sent to your email!",
    validationErrorMessage: "Please correct the highlighted fields.",
    onSuccess: () => {
      // Persistent state — a toast alone is easy to miss, leaving an empty
      // form that looks like nothing happened.
      setSentTo(formData.email)
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

  if (sentTo) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15">
          <MailCheck className="size-6 text-primary" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If an account exists for <strong>{sentTo}</strong>, a password reset
          link is on its way. The link expires after a short while, so use it
          soon.
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="h-10 w-full rounded-xl">
            <Link href="/login">Back to sign in</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full rounded-xl text-muted-foreground"
            onClick={() => setSentTo(null)}
          >
            Use a different email
          </Button>
        </div>
      </div>
    )
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

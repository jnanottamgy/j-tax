"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MailCheck } from "lucide-react"

import { signUp } from "@/app/actions/auth"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { signupSchema } from "@/lib/validations/auth"

const emptyForm = {
  name: "",
  firmName: "",
  email: "",
  password: "",
  confirmPassword: "",
}

export function SignUpForm() {
  const router = useRouter()
  const [formData, setFormData] = useState(emptyForm)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  const { submit, getError, isPending, formError, clearErrors: _clearErrors } = useValidatedForm({
    schema: signupSchema,
    successMessage: "Account created successfully!",
    validationErrorMessage: "Please correct the highlighted fields.",
    onSuccess: (result) => {
      // Only tell the user to sign in when they actually can. If Supabase
      // requires email confirmation, show a persistent check-your-inbox state.
      if (result.data?.needsEmailConfirm) {
        setNeedsEmailConfirm(true)
      } else {
        router.push("/login?signup=success")
      }
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("email", data.email)
      fd.set("password", data.password)
      fd.set("name", data.name)
      fd.set("firmName", data.firmName)
      fd.set("confirmPassword", data.confirmPassword)
      return signUp({}, fd)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  if (needsEmailConfirm) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15">
          <MailCheck className="size-6 text-primary" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold">Confirm your email</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We sent a confirmation link to <strong>{formData.email}</strong>.
          Click it, then come back and sign in.
        </p>
        <Button asChild variant="outline" className="h-10 w-full rounded-xl">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && <FormAlert message={formError} />}

      <FormField label="Firm Name" htmlFor="firmName" required error={getError("firmName")}>
        <Input
          id="firmName"
          type="text"
          value={formData.firmName}
          onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
          placeholder="Sharma & Associates"
          className="input-premium h-10 rounded-xl"
          disabled={isPending}
          aria-invalid={!!getError("firmName")}
        />
      </FormField>

      <FormField label="Your Full Name" htmlFor="name" required error={getError("name")}>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="CA Rahul Sharma"
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
      />
    </form>
  )
}

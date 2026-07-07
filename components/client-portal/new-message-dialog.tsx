"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { z } from "zod"

import { sendClientMessage } from "@/app/actions/client-portal-messages"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useValidatedForm } from "@/hooks/use-validated-form"

const schema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message is too long (max 2000 characters)"),
})

export function NewMessageDialog() {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")

  const { submit, getError, isPending, formError, clearErrors } = useValidatedForm({
    schema,
    successMessage: "Message sent to your team",
    onSuccess: () => {
      setContent("")
      setOpen(false)
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("content", data.content)
      return sendClientMessage({}, fd)
    },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setContent("")
      clearErrors()
    }
  }

  return (
    <>
      <Button onClick={() => handleOpenChange(true)}>
        <Send className="size-4 mr-2" />
        New Message
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message your team</DialogTitle>
            <DialogDescription>
              Your tax team will see this right away and typically responds
              within 24 business hours.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit({ content })
            }}
            className="space-y-4 pt-2"
            noValidate
          >
            {formError && <FormAlert message={formError} />}

            <FormField label="Message" htmlFor="content" required error={getError("content")}>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your question or update here..."
                rows={5}
                disabled={isPending}
                aria-invalid={!!getError("content")}
                className="resize-none"
              />
            </FormField>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <SubmitButton
                isPending={isPending}
                pendingLabel="Sending..."
                label="Send message"
                className="flex-1"
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

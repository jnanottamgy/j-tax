"use client"

import { MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  buildWhatsAppUrl,
  formatWhatsAppNumber,
  resolveWhatsAppNumber,
} from "@/lib/messaging/whatsapp-link"

type WhatsAppButtonProps = {
  /** Contact to message. The dedicated whatsapp field wins over phone. */
  contact: {
    whatsapp?: string | null
    phone?: string | null
    phoneNumber?: string | null
  }
  /** Draft text — opens with this already typed, ready to send. */
  message?: string | null
  label?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
  /** Icon only, for tight rows and toolbars. */
  iconOnly?: boolean
}

/**
 * Opens WhatsApp with the recipient and a drafted message already filled in.
 * The user reviews and presses send — nothing is sent on their behalf.
 *
 * When the contact has no usable number the button stays visible but disabled,
 * with a tooltip saying why. Hiding it would leave people wondering where the
 * WhatsApp option went on that one client.
 */
export function WhatsAppButton({
  contact,
  message,
  label = "WhatsApp",
  variant = "outline",
  size = "default",
  className,
  iconOnly = false,
}: WhatsAppButtonProps) {
  const number = resolveWhatsAppNumber(contact)
  const url = buildWhatsAppUrl(number, message)
  const pretty = formatWhatsAppNumber(number)

  if (!url) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span wrapper: a disabled button emits no pointer events, so the
                tooltip would never trigger and the reason stays hidden. */}
            <span className="inline-flex">
              <Button
                type="button"
                variant={variant}
                size={iconOnly ? "icon" : size}
                className={className}
                disabled
                aria-label="WhatsApp unavailable — no valid mobile number"
              >
                <MessageCircle />
                {!iconOnly && label}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            No valid mobile number on file for this contact.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const button = (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      className={cn("text-emerald-500 hover:text-emerald-400", className)}
      asChild
    >
      {/* A real anchor, so middle-click and "open in new tab" behave normally.
          noreferrer alongside _blank keeps the opener inaccessible. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Send WhatsApp message to ${pretty ?? "contact"}`}
      >
        <MessageCircle />
        {!iconOnly && label}
      </a>
    </Button>
  )

  if (!iconOnly) return button

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>WhatsApp {pretty}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

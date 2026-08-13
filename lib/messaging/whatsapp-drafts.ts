/**
 * Pre-written WhatsApp drafts.
 *
 * These open in WhatsApp with the text already filled in; the user reads it,
 * edits if they want, and presses send. So they are written to be sendable
 * as-is — complete sentences, no placeholder debris, and no variable that can
 * render as "undefined" in front of a client.
 *
 * House style: plain and courteous, the way an Indian practice actually writes
 * to a client. Amounts in ₹ with Indian digit grouping, dates as dd Mon yyyy.
 * WhatsApp renders *text* as bold, which is used sparingly for the one figure
 * or date that matters.
 */

import { formatINR } from "@/lib/india/format"

/** Dates must read the same for everyone — never locale-dependent. */
function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function money(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null
  return formatINR(amount)
}

/** Drop empty lines so a missing optional detail never leaves a blank gap. */
function lines(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join("\n")
}

function greeting(name: string | null | undefined): string {
  const clean = name?.trim()
  return clean ? `Hello ${clean},` : "Hello,"
}

function signOff(firmName: string | null | undefined): string {
  const clean = firmName?.trim()
  return clean ? `\nRegards,\n${clean}` : ""
}

export type DraftContext = {
  clientName?: string | null
  firmName?: string | null
}

/** Neutral opener — used by the generic "WhatsApp" button on a client record. */
export function draftGeneral(ctx: DraftContext): string {
  return lines(
    greeting(ctx.clientName),
    "",
    "Hope you are doing well. Wanted to check in regarding your ongoing work with us.",
    signOff(ctx.firmName)
  )
}

export function draftInvoiceReminder(
  ctx: DraftContext & {
    invoiceNumber?: string | null
    amount?: number | null
    dueDate?: Date | string | null
    isOverdue?: boolean
  }
): string {
  const amount = money(ctx.amount)
  const due = formatDate(ctx.dueDate)

  return lines(
    greeting(ctx.clientName),
    "",
    ctx.isOverdue
      ? `This is a gentle reminder that invoice ${ctx.invoiceNumber ?? ""}`.trim() +
          ` is currently overdue.`
      : `This is a gentle reminder regarding invoice ${ctx.invoiceNumber ?? ""}`.trim() + ".",
    "",
    amount ? `Amount: *${amount}*` : null,
    due ? `Due date: *${due}*` : null,
    "",
    "Kindly arrange the payment at your convenience. Do let us know once done, or if you would like the invoice resent.",
    signOff(ctx.firmName)
  )
}

export function draftComplianceReminder(
  ctx: DraftContext & {
    title?: string | null
    dueDate?: Date | string | null
    filingPeriod?: string | null
  }
): string {
  const due = formatDate(ctx.dueDate)

  return lines(
    greeting(ctx.clientName),
    "",
    `This is regarding your upcoming compliance${ctx.title ? `: ${ctx.title}` : ""}.`,
    "",
    ctx.filingPeriod ? `Period: ${ctx.filingPeriod}` : null,
    due ? `Due date: *${due}*` : null,
    "",
    "Please share the required details and documents at the earliest so we can complete the filing well before the deadline.",
    signOff(ctx.firmName)
  )
}

export function draftDocumentRequest(
  ctx: DraftContext & { items?: string[]; dueDate?: Date | string | null }
): string {
  const due = formatDate(ctx.dueDate)
  const list = (ctx.items ?? []).filter(Boolean)

  return lines(
    greeting(ctx.clientName),
    "",
    "To proceed with your work, we need the following documents:",
    "",
    ...list.map((item, i) => `${i + 1}. ${item}`),
    list.length ? "" : null,
    due ? `Kindly share them by *${due}*.` : "Kindly share them at your earliest convenience.",
    "",
    "You may reply to this message with the files directly.",
    signOff(ctx.firmName)
  )
}

export function draftTaskUpdate(
  ctx: DraftContext & { taskTitle?: string | null; status?: string | null }
): string {
  return lines(
    greeting(ctx.clientName),
    "",
    ctx.taskTitle
      ? `An update on *${ctx.taskTitle}*:`
      : "An update on your ongoing work:",
    "",
    ctx.status ? `Current status: ${ctx.status}` : null,
    "",
    "Do let us know if you have any questions.",
    signOff(ctx.firmName)
  )
}

/** First contact after a lead comes in. */
export function draftLeadFollowUp(
  ctx: DraftContext & { leadName?: string | null; service?: string | null }
): string {
  return lines(
    greeting(ctx.leadName ?? ctx.clientName),
    "",
    ctx.service
      ? `Thank you for your interest in our ${ctx.service} services.`
      : "Thank you for reaching out to us.",
    "",
    "We would be glad to help. Could you let us know a convenient time to discuss your requirement?",
    signOff(ctx.firmName)
  )
}

/** Sent alongside a quotation so the client knows to expect it. */
export function draftQuotationFollowUp(
  ctx: DraftContext & { quotationNumber?: string | null; total?: number | null }
): string {
  const total = money(ctx.total)

  return lines(
    greeting(ctx.clientName),
    "",
    `Sharing our proposal${ctx.quotationNumber ? ` (${ctx.quotationNumber})` : ""} for your consideration.`,
    "",
    total ? `Total: *${total}*` : null,
    "",
    "Please review at your convenience and let us know if you would like any changes. Happy to walk you through it over a call.",
    signOff(ctx.firmName)
  )
}

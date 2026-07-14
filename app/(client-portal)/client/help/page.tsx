import Link from "next/link"
import {
  Calendar,
  FileText,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
} from "lucide-react"

import { getFirmSettings } from "@/lib/firm-settings"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const FAQS = [
  {
    q: "How do I pay an invoice?",
    a: "Open Invoices and press “Pay” next to any unpaid invoice — you'll see the firm's bank and UPI details with your invoice number to quote. Once you've paid, the team records it and the invoice updates.",
    href: "/client/invoices",
    icon: Receipt,
  },
  {
    q: "Where can I see my filing deadlines?",
    a: "The Deadlines page lists every upcoming statutory due date for your account, and Compliance shows the live status of each filing.",
    href: "/client/deadlines",
    icon: Calendar,
  },
  {
    q: "How do I ask my tax team a question?",
    a: "Use Messages → New Message. The team sees it immediately and typically replies within 24 business hours.",
    href: "/client/messages",
    icon: MessageSquare,
  },
  {
    q: "What do the compliance statuses mean?",
    a: "Pending means the filing is scheduled, In Progress means the team is working on it, Filed/Completed means it has been submitted, and Overdue means the statutory date passed — the team will already be on it.",
    href: "/client/compliance",
    icon: FileText,
  },
]

export default async function ClientHelpPage() {
  const cfg = await getFirmSettings()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help &amp; Support</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Quick answers about using your client portal.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {FAQS.map((faq) => (
          <Link key={faq.q} href={faq.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <faq.icon className="size-4 text-primary" aria-hidden />
                  {faq.q}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="size-4 text-blue-500" aria-hidden />
            Still need help?
          </CardTitle>
          <CardDescription>Contact {cfg.firmName} directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cfg.replyToEmail || cfg.fromEmail ? (
            <p className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              <a
                href={`mailto:${cfg.replyToEmail || cfg.fromEmail}`}
                className="underline hover:text-blue-500"
              >
                {cfg.replyToEmail || cfg.fromEmail}
              </a>
            </p>
          ) : null}
          {cfg.firmPhone ? (
            <p className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" aria-hidden />
              <a href={`tel:${cfg.firmPhone}`} className="underline hover:text-blue-500">
                {cfg.firmPhone}
              </a>
            </p>
          ) : null}
          <p className="flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
            <Link href="/client/messages" className="underline hover:text-blue-500">
              Send a message through the portal
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

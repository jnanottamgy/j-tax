import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Globe, Mail, AlertTriangle } from "lucide-react"

import { getFirmSettings } from "@/lib/firm-settings"

export const metadata = {
  title: "Email Setup Guide — J-TACS",
}

/**
 * Firm Email Setup Guide — accessible from Settings and from the
 * onboarding wizard email-config step. Explains the two send modes
 * (verified-domain direct vs platform fallback), DNS records, SPF/DKIM/DMARC,
 * and common troubleshooting.
 *
 * The worked examples render THIS firm's own name/address (falling back to
 * neutral placeholders before Settings is filled in) — never another firm's,
 * which is both confusing and a cross-tenant branding leak.
 */
export default async function EmailSetupGuidePage() {
  const firm = await getFirmSettings()

  const firmName = firm.firmName || "Your Firm Name"
  const fromEmail = firm.fromEmail || "office@yourfirm.com"
  const firmDomain =
    firm.firmDomain || fromEmail.split("@")[1] || "yourfirm.com"

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Firm-Branded Email Setup"
        description="How outbound email from J-TACS appears to your clients, and how to verify your domain so messages send directly from your firm's address."
        backHref="/settings"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Two send modes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
            <p className="font-medium text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Mode A — Verified domain (direct)
            </p>
            <pre className="text-xs bg-black/30 rounded p-2 overflow-x-auto">
{`From:     ${firmName} <${fromEmail}>
Reply-To: ${fromEmail}
SPF / DKIM aligned with ${firmDomain} — inbox placement maximized.`}
            </pre>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
            <p className="font-medium text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Mode B — Platform fallback
            </p>
            <pre className="text-xs bg-black/30 rounded p-2 overflow-x-auto">
{`From:     ${firmName} <notifications@<platform-domain>>
Reply-To: ${fromEmail}
Envelope-From uses the platform's verified domain; firm branding still visible.`}
            </pre>
            <p className="text-xs">
              Used automatically when your firm domain isn&apos;t verified yet. Replies still
              land in your inbox via Reply-To.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> DNS records to publish
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The records are <strong>generated for your domain specifically</strong> — your DKIM
            key is unique to you, so they cannot be written by hand or copied from another
            firm. Open <strong>Settings → Email Domain Verification</strong> to see your exact
            records, then paste them at your DNS provider (Cloudflare, Route 53, GoDaddy, etc.).
          </p>

          <div className="space-y-3">
            <div className="rounded-lg border border-white/[0.08] p-3 space-y-1">
              <p className="font-medium text-foreground">1. Copy each record exactly</p>
              <p className="text-xs">
                Host and value must match character-for-character. A truncated DKIM value is the
                most common reason a domain never finishes verifying.
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.08] p-3 space-y-1">
              <p className="font-medium text-foreground">2. Merge SPF, never duplicate it</p>
              <p className="text-xs">
                If your domain already publishes an SPF record, add the include to the existing
                one. Two SPF records cause a permerror and break authentication for all your mail
                (RFC 7208 § 3.2).
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.08] p-3 space-y-1">
              <p className="font-medium text-foreground">3. Strip your DNS panel&apos;s extras</p>
              <p className="text-xs">
                Some panels append the domain automatically. If the host shown is{" "}
                <code className="bg-white/[0.06] px-1 rounded">resend._domainkey.{firmDomain}</code>,
                many panels want only{" "}
                <code className="bg-white/[0.06] px-1 rounded">resend._domainkey</code>. Do not end
                up with the domain twice.
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.08] p-3 space-y-1">
              <p className="font-medium text-foreground">4. Click Verify</p>
              <p className="text-xs">
                Verification is performed by the email provider, not by this app — publishing the
                records is not enough on its own. DNS usually applies within 10 minutes, but can
                take up to 48 hours. Your email keeps sending via the platform address meanwhile,
                so nothing is blocked while you wait.
              </p>
            </div>
          </div>

          <p className="text-xs">
            After publishing, click <strong>Verify Now</strong> in Settings. Propagation can take a
            few minutes to 48 hours.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Verification keeps failing</p>
            <p className="text-xs">
              Check that the host field at your DNS provider is just the <em>prefix</em> (e.g.
              <code className="bg-white/[0.06] px-1 rounded">_jtacs-verify</code>), not the full
              FQDN. Most UIs append your domain automatically.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Emails landing in spam</p>
            <p className="text-xs">
              Confirm DKIM CNAME is in place, DMARC published with at least <code>p=none</code>,
              and your sender display name matches the From address. Avoid no-reply addresses
              that don&apos;t have a working Reply-To.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Bounces / hard failures</p>
            <p className="text-xs">
              Check Resend&apos;s dashboard for delivery logs. Hard bounces auto-suppress the
              recipient; clean your client emails before bulk sends.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Where the firm identity lives in the codebase</p>
            <p className="text-xs">
              Every outbound email reads from the <code className="bg-white/[0.06] px-1 rounded">firm_settings</code>{" "}
              table in real time. No restart is needed after a PARTNER changes settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

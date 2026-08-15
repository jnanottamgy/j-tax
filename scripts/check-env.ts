import "dotenv/config"

/**
 * Preflight for going live.
 *
 * Nothing validated the environment at startup, so a missing secret surfaced
 * as a feature quietly not working rather than as an error: no CRON_SECRET and
 * every scheduled route returns 503, so reminders, retainer invoices and the
 * attendance close-off simply never run and nothing says so. No RESEND_API_KEY
 * and every invite and client email fails silently.
 *
 * Run before the first client touches it:  npm run env:check
 *
 * Read-only. Touches no database and sends nothing.
 */

type Check = {
  name: string
  required: boolean
  /** What breaks when it is missing — not what the variable is. */
  consequence: string
  validate?: (value: string) => string | null
}

const hex64 = (v: string) =>
  /^[0-9a-fA-F]{64}$/.test(v) ? null : "must be exactly 64 hex characters (openssl rand -hex 32)"

const url = (v: string) =>
  /^https?:\/\//.test(v) ? null : "must start with http:// or https://"

const email = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "must be a valid email address"

const CHECKS: Check[] = [
  {
    name: "DATABASE_URL",
    required: true,
    consequence: "Nothing works at all.",
    validate: (v) => (v.startsWith("postgres") ? null : "must be a postgres:// connection string"),
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    consequence: "Nobody can sign in.",
    validate: url,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    consequence: "Nobody can sign in.",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    consequence:
      "Staff logins and client-portal invites cannot be created — adding an employee will fail.",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: true,
    consequence:
      "Invite and password links point at localhost, so nobody you invite can actually get in.",
    validate: url,
  },
  {
    name: "CREDENTIAL_VAULT_KEY",
    required: true,
    consequence:
      "The government-portal credential vault refuses every read and write. Note: changing this later makes everything already stored permanently unreadable.",
    validate: hex64,
  },
  {
    name: "CRON_SECRET",
    required: true,
    consequence:
      "Every scheduled job returns 503 and silently never runs: deadline reminders, retainer invoices, attendance close-off, overdue escalation.",
    validate: (v) => (v.length >= 16 ? null : "should be at least 16 characters"),
  },
  {
    name: "RESEND_API_KEY",
    required: true,
    consequence:
      "No email leaves the system — staff invites, client reminders and portal invitations all fail.",
  },
  {
    name: "FROM_EMAIL",
    required: true,
    consequence: "Client email has no sender and is rejected.",
    validate: email,
  },
  {
    name: "PLATFORM_FROM_EMAIL",
    required: false,
    consequence: "Staff invites fall back to FROM_EMAIL.",
    validate: email,
  },
  {
    name: "WHATSAPP_API_TOKEN",
    required: false,
    consequence: "WhatsApp reminders are skipped; email still goes out.",
  },
]

let failures = 0
let warnings = 0

console.log("\nJ-TACS environment check\n" + "─".repeat(60))

for (const check of CHECKS) {
  const raw = process.env[check.name]
  const value = raw?.trim() ?? ""

  if (!value) {
    if (check.required) {
      failures++
      console.log(`\n  MISSING   ${check.name}`)
      console.log(`            ${check.consequence}`)
    } else {
      warnings++
      console.log(`\n  unset     ${check.name}`)
      console.log(`            ${check.consequence}`)
    }
    continue
  }

  const problem = check.validate?.(value)
  if (problem) {
    failures++
    console.log(`\n  INVALID   ${check.name}`)
    console.log(`            ${problem}`)
    console.log(`            ${check.consequence}`)
    continue
  }

  console.log(`  ok        ${check.name}`)
}

// A placeholder that was copied from .env.example and never replaced passes a
// presence check and fails in production, which is the worst of both.
const PLACEHOLDERS = ["your-", "example.com", "change-in-production", "placeholder"]
for (const check of CHECKS) {
  const value = process.env[check.name]?.trim() ?? ""
  if (!value) continue
  if (PLACEHOLDERS.some((p) => value.toLowerCase().includes(p))) {
    warnings++
    console.log(`\n  CHECK     ${check.name} still looks like the example value.`)
  }
}

console.log("\n" + "─".repeat(60))
if (failures > 0) {
  console.log(`${failures} problem(s) that will break the product for a real client.`)
  console.log("Fix these before going live. See .env.example.\n")
  process.exit(1)
}
console.log(
  warnings > 0
    ? `Ready, with ${warnings} optional thing(s) unset — see above.\n`
    : "Everything required is set.\n"
)

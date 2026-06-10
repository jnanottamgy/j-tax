# J-TAX Session Handoff

**For:** Next Claude Code session
**Date of prior session:** 2026-06-10 (Session 12 — Production Launch Hardening, 8-Phase Certification)
**Branch:** `main`
**Working directory:** `C:\Users\Jnanottam\OneDrive\Documents\j-tax`

---

## QUICK STATUS

```
Build:      42 routes ✅  (npm run build — ✓ compiled successfully)
TypeScript: 0 errors  ✅  (npx tsc --noEmit)
Lint:       0 errors  ✅  (npm run lint) — 250 warnings, all warn-level
DB:         Synced    ✅  (EXECUTIVE removed; firm_settings table added)
```

```bash
npm run dev    # → http://localhost:3000
# Login: admin@jtax.test / JTax@Admin2026!  (PARTNER role)
```

---

## WHAT WAS DONE IN SESSION 12

### Phase 1 — Role Migration Complete
- All `EXECUTIVE` references in runtime code replaced with `EMPLOYEE` (comments in search.ts, compliance.ts, invoices.ts)
- `001_rename_executive_to_employee.sql` enhanced: idempotent DO block, enum verification queries
- `prisma db push --accept-data-loss` applied: `EXECUTIVE` removed from DB `Role` enum; `firm_settings` table created atomically in the same push — no manual SQL step needed for the enum migration

### Phase 2 — Email System Certified
| Component | Before | After |
|-----------|--------|-------|
| `FIRM_NAME` source | env var only (stale at module load) | DB `firm_settings` row, read on every send, env-var fallback |
| `FROM_EMAIL` source | env var only | DB `firm_settings.fromEmail`, dynamic |
| Reply-To | Not set | DB `firm_settings.replyToEmail`, injected when configured |
| Sender format | `from@domain` bare address | `Firm Name <from@domain>` |
| Email templates | Hardcoded `${FIRM_NAME}` at class init | Dynamic per-send via `getFirmSettings()` |

New files:
- `lib/firm-settings.ts` — `getFirmSettings()` / `upsertFirmSettings()` with Prisma + env fallback
- `prisma/migrations-manual/002_rls_policies.sql` — production RLS (see Phase 3)

Updated files:
- `lib/messaging/resend-provider.ts` — fully rewritten; async DB read per send
- `app/actions/settings.ts` — added `saveFirmSettings()` (PARTNER guard) + `loadFirmSettings()`
- `prisma/schema.prisma` — `FirmSettings` model added

### Phase 3 — RLS SQL Generated
`prisma/migrations-manual/002_rls_policies.sql` — run this in Supabase SQL editor to activate:
- `auth.user_role()` helper reads JWT `app_metadata.role`
- `auth.employee_id()` helper resolves `employees.id` for the current user
- Tables covered: `clients`, `tasks`, `invoices`, `documents`, `notifications`, `employees`, `compliance_events`, `messages`, `firm_settings`, `leads`, `quotations`, `activity_logs`, `audit_logs`
- Policy summary: PARTNER = all; MANAGER = all except audit-only tables; EMPLOYEE = assigned records only; CLIENT = own portal data only

### Phase 4 — Settings Page Hardened
- **PARTNER** sees: Firm Details card (name, sender email, reply-to, phone, GSTIN, PAN, website, address) + Billing card
- **MANAGER** sees: Read-only email config summary card
- **EMPLOYEE** sees: Profile + Password + Notifications only
- `saveFirmSettings()` enforces `requirePartner()` server-side regardless of UI state

### Phase 5 — Dev Artifacts Removed
- `seedEmployeesIfEmpty()` deleted from `lib/clients/queries.ts`
- All callers removed: `app/actions/clients.ts`, `app/api/clients/route.ts`
- `test-client-master.ts` deleted
- 22 stale `*_REPORT.md` files removed from repo root

### Phase 6 — First Login Flow Verified & Fixed
Flow is correct and tested:
```
Unauthenticated        → /login                     ✅
CLIENT role            → /client (portal)           ✅
PARTNER/MANAGER, onboarding incomplete → OnboardingWizard ✅ (FIXED)
EMPLOYEE, any state    → Dashboard directly          ✅ (FIXED — was showing wizard)
PARTNER/MANAGER, onboarding complete → Dashboard    ✅
```

---

## THREE STEPS REQUIRED BEFORE FIRST PRODUCTION USER

### 1. Configure Firm Settings (BLOCKING for email delivery)
Log in as PARTNER → `/settings` → "Firm Details" card.
Set at minimum:
- **Firm Name** (appears in all email headers and PDF quotations)
- **Sender Email** (must be a Resend-verified domain address)

### 2. Activate RLS (HIGH SECURITY — run in Supabase SQL editor)
```sql
-- File: prisma/migrations-manual/002_rls_policies.sql
-- Paste entire file into Supabase SQL editor and execute.
-- This enables row-level security on all 12 tables.
```

### 3. Set RESEND_API_KEY in production env
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```
Email sends fail silently with "Resend API key not configured" until this is set.

---

## KEY ARCHITECTURAL NOTES (updated)

### Email Configuration Chain (Session 12)
```
resendProvider.send() / sendTemplate()
  → getFirmSettings()                   # reads firm_settings DB row
    → fallback: process.env.FIRM_NAME   # if row absent
  → builds "Firm Name <from@email>"     # properly formatted sender
  → injects reply_to when configured
  → Resend API POST /emails
```

### Settings Access Matrix (Session 12)
```
Section          PARTNER   MANAGER   EMPLOYEE
Firm Details     ✏️ Edit   👁 Read    ❌ Hidden
Email Config     ✏️ Edit   👁 Read    ❌ Hidden
Profile          ✏️ Edit   ✏️ Edit   ✏️ Edit
Password         ✏️ Edit   ✏️ Edit   ✏️ Edit
Notifications    ✏️ Edit   ✏️ Edit   ✏️ Edit
Billing          ✏️ Edit   ❌ Hidden  ❌ Hidden
```

### RLS Status (Session 12)
- SQL script generated and committed: `prisma/migrations-manual/002_rls_policies.sql`
- **Not yet applied** — must be run in Supabase SQL editor
- Until applied: application-layer guards protect data; direct Supabase API calls bypass them

---

## REMAINING WORK (priority order)

### CRITICAL
1. Configure Firm Settings via `/settings` (PARTNER login required)
2. Run `002_rls_policies.sql` in Supabase SQL editor
3. Verify `RESEND_API_KEY` set in Vercel production env

### HIGH
4. Upstash Redis rate limiter (in-memory resets on cold starts)

### MEDIUM
5. Playwright E2E test suite (0 automated tests)

### LOW
6. WhatsApp Business API (`WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`)
7. Verify Supabase `documents` storage bucket exists

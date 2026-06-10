# J-TAX Session Handoff

**For:** Next Claude Code session
**Date of prior session:** 2026-06-10 (Session 11 — 90-Day Operational Simulation + Workflow Bug Fixes)
**Branch:** `main`
**Working directory:** `C:\Users\Jnanottam\OneDrive\Documents\j-tax`

---

## QUICK STATUS

```
Build:      42 routes ✅  (npm run build)
TypeScript: 0 errors  ✅  (npx tsc --noEmit)
Lint:       0 errors  ✅  (npm run lint) — 260 warnings, all warn-level
Seed:       10 employees / 100 clients / 500 tasks / 200 invoices / 1000 notifications ✅
```

Session 11 ran a full 90-day operational simulation. The seed is live in the DB. 5 workflow
bugs were found and fixed. All changes committed to `679acce`.

```bash
npm run dev    # → http://localhost:3000
# Login: admin@jtax.test / JTax@Admin2026!  (PARTNER role)
```

---

## ⚠️ TWO STEPS REQUIRED BEFORE FIRST PRODUCTION USER

### 1. DB Migration (BLOCKING — run before any EMPLOYEE-role user logs in)

```sql
-- File: prisma/migrations-manual/001_rename_executive_to_employee.sql
-- Run once in Supabase SQL editor:
ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE';
```

### 2. Set FIRM_NAME in production env (IMPORTANT — affects all outgoing emails)

```
FIRM_NAME=Your Actual Firm Name
```

Email footers and subjects currently default to "Your Tax Firm". Set this in Vercel/prod before sending any emails to clients.

---

## WHAT WAS DONE IN SESSION 10

### Phase 1 — Onboarding Overhaul (FEAT-010)

Completely rewrote `components/onboarding/onboarding-wizard.tsx` (5 steps → 6 steps). The old wizard collected data but never created real DB records. The new wizard actually creates employees and clients in the DB.

**New 6-step flow:**

| Step | Changes from before |
|------|-------------------|
| 1 — Firm Information | Same content; improved UI with contextual guidance |
| 2 — Add Employees | **New** — inline multi-row form; calls `createEmployeeFromOnboarding`; skippable |
| 3 — Add Services | Same content; 8 services (added Payroll, Advisory); better UI |
| 4 — Add First Client | **New** — calls `createClientFromOnboarding`; shows success card; skippable |
| 5 — Configure Email | Replaces Notification Preferences step; adds Resend setup guidance |
| 6 — Ready to Launch | **New** — setup summary (employee/service/client counts) + quick-start links |

**New server actions added to `app/actions/onboarding.ts`:**
- `createEmployeeFromOnboarding(data)` — creates `Employee` record; duplicate email check
- `createClientFromOnboarding(data)` — creates `Client` with auto-generated `CLI-NNNN` code
- `saveEmailConfiguration(data)` — saves email/WhatsApp prefs to `user_metadata`
- `completeOnboarding` / `skipOnboarding` — updated from step 5 → step 6

**Layout:** Two-panel (sidebar step list + content area), animated progress bar, contextual guidance on every step, skippable optional steps, resume-on-reload support.

---

### Phase 2 — CRUD Verification (7 bugs fixed)

Full audit of all 9 modules. Every Create/Read/Update/Delete path reviewed.

| Fix | File | Problem | Fix |
|-----|------|---------|-----|
| CRUD-001 | `app/actions/invoices.ts` | `deleteInvoice` missing entirely | Added with paid-amount guard |
| CRUD-002 | `app/actions/invoices.ts` | `createInvoice` accepted ₹0/negative | Added amount > 0 guard |
| CRUD-003 | `app/actions/invoices.ts` | `updateInvoice` accepted arbitrary status strings via `as any` | Added `VALID_INVOICE_STATUSES` check |
| CRUD-004 | `app/actions/messages.ts` | `sendBulkReminders` used `client.phoneNumber` (legacy null field) instead of `client.phone` | Changed to `client.phone` in filter + recipient |
| CRUD-005 | `app/actions/employees.ts` | `deleteEmployee` let you delete employees with active client/task assignments | Added pre-delete count checks |
| CRUD-006 | `app/actions/tasks.ts` | `deleteTask` threw generic DB error for non-existent task | Added `findUnique` existence check |
| CRUD-007 | `app/actions/proposals.ts` | `FIRM_NAME` still defaulted to `"TaxWise Consultants"` | Changed to `"Your Tax Firm"` |

All 9 modules now pass full CRUD audit. Invalid-operation tests (delete paid invoice, overpay invoice, delete employee with clients, etc.) all return correct errors.

---

### Phase 3 — Form Validation Hardening (7 issues fixed)

Full audit of 14 forms. Checked: required fields, format validation, duplicate prevention, inline errors, loading states, success states, `canSubmit` guards.

| Fix | File | Problem | Fix |
|-----|------|---------|-----|
| VAL-001 | `components/payments/add-invoice-dialog.tsx` | `canSubmit` allowed amount ≤ 0 and dueDate < issueDate | Added numeric + date guards to `canSubmit` |
| VAL-002 | `components/proposals/add-lead-dialog.tsx` | `setTimeout(onClose, 100)` in render body — fired on every re-render | Moved to `useEffect` with `closedRef` guard |
| VAL-003 | `components/proposals/add-lead-dialog.tsx` | No `canSubmit` guard | Added name + email non-empty check |
| VAL-004 | `components/compliance/add-compliance-event-dialog.tsx` | No `canSubmit` guard | Added controlled title + dueDate state; guard on both |
| VAL-005 | `components/messaging/template-builder.tsx` | Variable input accepted whitespace-only strings | Added `.trim()` before guard check |
| VAL-006 | `lib/validations/settings.ts` | `passwordSchema` only `min(8)`; signup/reset required uppercase/lowercase/number/special | Added all 4 regex rules to match firm-wide policy |
| VAL-007 | `components/clients/client-onboarding-wizard.tsx` | Sidebar buttons let user jump to any step, bypassing all step validity checks | Added `isStepAccessible(index)` — inaccessible steps disabled + dimmed |

---

## REMAINING WORK (priority order)

### 0. CRITICAL (before first production user)
1. **DB migration** — `ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE'` in Supabase SQL editor
2. **Set `FIRM_NAME` env var** — defaults to "Your Tax Firm" in all emails

### 1. HIGH — Security
3. **Supabase RLS policies** — No row-level security. Authenticated users can query any table directly via the Supabase API, bypassing all application guards. Minimum needed: `clients`, `tasks`, `documents`, `invoices`.
4. **Upstash Redis rate limiter** — In-memory rate limiter resets on cold starts. Migration path documented in `lib/security/rate-limiter.ts`.

### 2. MEDIUM — Testing
5. **Playwright E2E tests** — Priority scenarios:
   - CLIENT cannot access `/`, `/clients`, `/work-tracker`
   - EMPLOYEE cannot access `/payments`, `/employees`, `/reports`, `/activity`
   - EMPLOYEE sees only assigned clients/tasks (not other employees' data)
   - Password reset end-to-end (email → confirm page → new password → login)
   - Invoice delete blocked when paid
   - Employee delete blocked when clients assigned

### 3. LOW — Polish
6. **Settings firm-level guard** — `/settings` accessible to all staff; firm name/GSTIN/address fields should be read-only for non-PARTNER roles within the page.
7. **WhatsApp Business API** — Set `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`. Banner in `whatsapp-chat.tsx` already handles unconfigured state.
8. **Supabase `documents` bucket** — Verify exists in Supabase dashboard; `assertDocumentBucketExists()` creates on first upload automatically.

---

## KEY ARCHITECTURAL NOTES

### Auth Layer Chain

```
Request
  → proxy.ts middleware (updateSession → JWT refresh via cookie rotation)
      → unauthenticated     → /login?redirectTo=<path>
      → missing role        → /unauthorized?reason=missing_role
      → CLIENT on auth page → /client
      → CLIENT on any path  → /client (via canAccessRoute failure)
      → staff RBAC check    → /unauthorized?from=<path>  (or /client for CLIENT role)
  → app/(app)/layout.tsx
      → no session          → /login
      → CLIENT role         → /client
  → app/(app)/page.tsx
      → CLIENT role         → /client  (before any DB query)
  → server action (requireAuth / requirePartner / requirePartnerOrManager)
  → data query (getEmployeeScopeId for EMPLOYEE row-level filtering)
```

### Onboarding Flow (new)

```
New PARTNER/MANAGER logs in
  → app/(app)/layout.tsx: onboardingStatus.completed === false
  → <OnboardingWizard /> rendered over full screen
  → Step 1: firm info → saveFirmInformation() → user_metadata
  → Step 2: employees → createEmployeeFromOnboarding() × N → DB
  → Step 3: services → saveServiceConfiguration() → user_metadata
  → Step 4: first client → createClientFromOnboarding() → DB
  → Step 5: email config → saveEmailConfiguration() → user_metadata
  → Step 6: launch → completeOnboarding() → onboardingCompleted = true → redirect /
```

### CRUD Invariants (enforced)

```
deleteEmployee  → blocked if assignedClients > 0 or openTasks > 0
deleteInvoice   → blocked if paidAmount > 0 or status = PAID
updateInvoice   → status must be in VALID_INVOICE_STATUSES
createInvoice   → amount must be > 0 and ≤ 10,00,00,000
recordPayment   → amount must be ≤ outstandingAmount; blocked on PAID/WAIVED/DISPUTED
deleteTask      → explicit existence check before delete (returns "Task not found." if missing)
sendBulkReminders → uses client.phone (not the legacy client.phoneNumber field)
```

### Form Validation Architecture

All forms use one of two patterns:
1. **`useValidatedForm` hook** — client-side Zod parse → inline field errors → server action → toast success/error. Has duplicate-submit guard via `inFlightRef`. Used by: Employee, Invoice, Task, Auth, Settings, Template Builder.
2. **`useActionState`** — native React form actions, server-side validation, `state.fieldErrors` displayed inline. Used by: Client Onboarding Wizard, Compliance Event, Lead, Quotation.

Both patterns show inline field errors next to inputs and a form-level banner for top-level errors. Both have loading states that disable the submit button. All submit buttons now have `canSubmit` guards that prevent submission before required fields are filled (no empty form round-trips).

### Password Policy (all paths now consistent)

```
Minimum 8 characters
At least one uppercase letter [A-Z]
At least one lowercase letter [a-z]
At least one number [0-9]
At least one special character [^A-Za-z0-9]
Maximum 128 characters
```

Enforced by: `signupSchema` (auth.ts), `newPasswordSchema` (auth.ts), `passwordSchema` (settings.ts — fixed in S10).

### Firm Branding in Emails

All firm-identifying text in outbound emails is env-var driven:
- `FIRM_NAME` → email headers, subjects, footers, quotation PDFs
- `FROM_EMAIL` → sender address, footer contact email
- `FIRM_PHONE` → footer phone (omitted if blank)

Safe defaults: `"Your Tax Firm"` / `""` / `""`. No hardcoded firm names remain anywhere in the codebase.

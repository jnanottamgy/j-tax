# J-TAX — Complete Project State Document

**Last updated:** 2026-06-10 (Session 12 — Production Launch Hardening, 8-Phase Certification)
**Branch:** `main`
**Last commit:** `fbb38f6` — feat(hardening): production launch hardening — 8-phase certification
**App URL:** http://localhost:3000 (dev) | Vercel (prod, not yet deployed)
**Test credentials:** `admin@jtax.test` / `JTax@Admin2026!` (PARTNER role)

---

## 1. WHAT THIS PROJECT IS

J-TAX is an enterprise tax operations management platform for Indian CA/tax firms. It manages:
- Client portfolio (GST, ITR, TDS, Payroll, Audit, ROC filings)
- Work tracker (Kanban board of tasks per client)
- Compliance calendar (deadline tracking with status)
- Payments & invoicing (with overdue tracking)
- Document vault (Supabase Storage with signed URLs)
- Employee/team management with role-based access
- WhatsApp + email messaging (via Resend; WhatsApp uses real Meta Cloud API when configured)
- Client-facing portal (separate UI for CLIENT-role users)
- Reporting center (CSV/XLSX/PDF export)
- **Workforce Intelligence** (session tracking, attendance, performance, alerts — PARTNER-only)
- **Proposals & Quotations** (Lead CRM, quotation builder, PDF, email automation, client portal)

---

## 2. TECH STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.6 (App Router, Turbopack) |
| Language | TypeScript | 5.x (strict mode) |
| Runtime | Node.js | 24.12.0 |
| Database | PostgreSQL (Supabase-hosted) | — |
| ORM | Prisma | 7.8.0 (with `@prisma/adapter-pg`) |
| Auth | Supabase Auth | `@supabase/ssr` 2.x |
| UI | React 19 + Tailwind CSS 4 + Shadcn UI | — |
| State | Zustand 5 | sidebar store + client onboarding wizard |
| Forms | React Hook Form 7 + Zod 4 | — |
| Email | Resend | `resend` 6.x |
| Storage | Supabase Storage | — |
| Charts | Recharts 2 | — |
| Animation | Framer Motion 11 | — |
| Export | pdfkit + xlsx | — |
| Package manager | npm 11.6.2 | — |

---

## 3. ROLE STRUCTURE

| Role | Level | Represents | Key restrictions |
|------|-------|------------|-----------------|
| `PARTNER` | 3 | Firm owner, Managing Partner, Senior CA | Full access |
| `MANAGER` | 2 | Team Lead, Department Head, Senior CA | No audit logs, no workforce, no firm revenue analytics |
| `EMPLOYEE` | 1 | Accountant, Tax Associate, Article | Assigned data only; no payments, employees, reports, proposals, audit logs |
| `CLIENT` | 0 | End client | Client portal only (`/client/*`); blocked from all staff routes |

> **⚠️ DB Migration Required:** Run `prisma/migrations-manual/001_rename_executive_to_employee.sql` once in Supabase SQL editor before using the app with real data.

---

## 4. ROUTE ACCESS MATRIX

| Route | PARTNER | MANAGER | EMPLOYEE | CLIENT |
|-------|---------|---------|----------|--------|
| `/` | ✅ | ✅ | ✅ | 🔒→`/client` |
| `/clients` | ✅ All | ✅ All | ✅ Assigned only | 🔒→`/client` |
| `/work-tracker` | ✅ All | ✅ All | ✅ Assigned only | 🔒→`/client` |
| `/compliance` | ✅ All | ✅ All | ✅ Assigned only | 🔒→`/client` |
| `/calendar` | ✅ | ✅ | ✅ | 🔒→`/client` |
| `/documents` | ✅ | ✅ | ✅ | 🔒→`/client` |
| `/messaging` | ✅ | ✅ | ✅ | 🔒→`/client` |
| `/notifications` | ✅ | ✅ | ✅ | 🔒→`/client` |
| `/settings` | ✅ | ✅ | ✅ | 🔒→`/client` |
| `/payments` | ✅ | ✅ | 🔒 | 🔒→`/client` |
| `/payments/invoices` | ✅ | ✅ | 🔒 | 🔒→`/client` |
| `/employees` | ✅ | ✅ | 🔒 | 🔒→`/client` |
| `/reports` | ✅ | ✅ | 🔒 | 🔒→`/client` |
| `/proposals` | ✅ | ✅ | 🔒 | 🔒→`/client` |
| `/activity` (audit) | ✅ | 🔒 | 🔒 | 🔒→`/client` |
| `/workforce` | ✅ | 🔒 | 🔒 | 🔒→`/client` |
| `/client/*` | 🔒 | 🔒 | 🔒 | ✅ |

CLIENT routing enforced at 4 layers: `signIn` action, `proxy.ts`, `(app)/layout.tsx`, `(app)/page.tsx`.

---

## 5. REPOSITORY STRUCTURE (key files only)

```
j-tax/
├── app/
│   ├── (app)/
│   │   ├── page.tsx                  # Role dashboards + CLIENT guard
│   │   ├── layout.tsx                # CLIENT role redirect to /client
│   │   ├── clients/page.tsx
│   │   ├── employees/page.tsx
│   │   ├── proposals/page.tsx
│   │   ├── proposals/quotations/new/page.tsx
│   │   ├── proposals/quotations/[id]/page.tsx
│   │   ├── workforce/page.tsx            # PARTNER-only
│   │   ├── workforce/[employeeId]/page.tsx
│   │   ├── work-tracker/
│   │   ├── compliance/
│   │   ├── payments/invoices/
│   │   ├── documents/
│   │   ├── messaging/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── settings/page.tsx
│   ├── (auth)/login, signup, reset-password
│   ├── (client-portal)/client/
│   ├── auth/
│   │   ├── callback/route.ts
│   │   └── reset-password/confirm/page.tsx  # PKCE code exchange + styled
│   ├── actions/
│   │   ├── auth.ts                   # CLIENT role routing on login
│   │   ├── clients.ts                # Full CRUD — deleteClient verified
│   │   ├── employees.ts              # Full CRUD — deleteEmployee guards active assignments
│   │   ├── tasks.ts                  # Full CRUD — deleteTask existence check added
│   │   ├── compliance.ts, documents.ts, messages.ts
│   │   ├── invoices.ts               # Full CRUD — deleteInvoice added S10
│   │   ├── search.ts, activity.ts
│   │   ├── reports.ts, onboarding.ts
│   │   ├── workforce.ts, proposals.ts
│   │   └── settings.ts, notifications.ts
│   ├── (quotation-portal)/q/[token]/
│   ├── api/
│   ├── unauthorized/page.tsx
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── dashboard/
│   │   ├── partner-command-center.tsx
│   │   ├── manager-dashboard.tsx
│   │   ├── employee-dashboard.tsx
│   │   ├── executive-summary.tsx
│   │   ├── setup-checklist.tsx
│   │   └── kpi-cards.tsx, revenue-chart.tsx, filing-chart.tsx, etc.
│   ├── layout/
│   │   ├── app-sidebar.tsx
│   │   ├── app-shell.tsx
│   │   └── heartbeat-tracker.tsx
│   ├── onboarding/
│   │   └── onboarding-wizard.tsx     # REWRITTEN S10 — 6-step guided setup
│   ├── clients/
│   │   └── client-onboarding-wizard.tsx  # UPDATED S10 — step-jump guard
│   ├── compliance/
│   │   └── add-compliance-event-dialog.tsx  # UPDATED S10 — canSubmit guard
│   ├── payments/
│   │   └── add-invoice-dialog.tsx    # UPDATED S10 — amount>0 + date canSubmit
│   ├── proposals/
│   │   └── add-lead-dialog.tsx       # REWRITTEN S10 — useEffect close, canSubmit
│   ├── messaging/
│   │   └── template-builder.tsx      # UPDATED S10 — variable trim guard
│   ├── work-tracker/
│   └── settings/
├── hooks/
│   └── use-validated-form.ts         # Client-side Zod + duplicate-submit guard
├── lib/
│   ├── auth/types.ts, roles.ts, scope.ts, guards.ts, session.ts
│   ├── messaging/
│   │   ├── whatsapp-api.ts           # Real Meta Cloud API v19.0
│   │   ├── resend-provider.ts        # Env-var driven branding
│   │   ├── notification-service.ts
│   │   └── provider-interface.ts
│   ├── validations/
│   │   ├── auth.ts, client.ts, employee.ts
│   │   ├── invoice.ts, task.ts, message.ts
│   │   └── settings.ts               # UPDATED S10 — password complexity added
│   ├── stores/sidebar-store.ts
│   ├── navigation.ts
│   ├── clients/queries.ts
│   └── workforce/, quotations/, etc.
├── prisma/
│   ├── schema.prisma
│   └── migrations-manual/
│       └── 001_rename_executive_to_employee.sql
├── proxy.ts
├── eslint.config.mjs
├── .github/workflows/ci.yml
└── vercel.json
```

---

## 6. ENVIRONMENT VARIABLES — CURRENT STATUS

All required vars set in `.env`:
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- `DATABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `RESEND_API_KEY` ✅
- `FROM_EMAIL` ✅ — used as firm contact email in all outbound emails
- `NEXT_PUBLIC_APP_URL` ✅ (http://localhost:3000)
- `CRON_SECRET` ✅ (random hex)
- `FIRM_NAME` ⚠️ Optional — defaults to "Your Tax Firm" in emails/PDFs (set before launch)
- `FIRM_PHONE` ⚠️ Optional — shown in email footers if set; omitted if blank
- `FIRM_ADDRESS` ⚠️ Optional — used in quotation PDFs
- `WHATSAPP_API_TOKEN` ⚠️ Optional — required for WhatsApp messaging; returns "not configured" if absent
- `WHATSAPP_PHONE_NUMBER_ID` ⚠️ Optional — required with `WHATSAPP_API_TOKEN`

---

## 7. TESTING STATUS

| Area | Status | Notes |
|------|--------|-------|
| Production build | ✅ Passes | 42 routes, 0 errors |
| TypeScript strict mode | ✅ Passes | 0 errors |
| ESLint | ✅ Passes | 0 errors, 260 warnings (all `warn`, not `error`) |
| Login/auth flow | ✅ Manual | |
| All major pages | ✅ Manual | |
| Setup checklist | ✅ Done | Live DB counts |
| Employee enable/disable | ✅ Done | Actions + UI wired |
| Client portal upload | ✅ Done | Signed URL + XHR progress |
| Dashboard caching | ✅ Done | 60s unstable_cache per role |
| CI/CD | ✅ Done | GitHub Actions |
| Notification prefs | ✅ Done | Saved to user_metadata |
| Onboarding data | ✅ Done | All steps save to user_metadata / DB |
| Mock data eliminated | ✅ Done | lib/dashboard-data.ts, lib/clients-data.ts deleted; WhatsApp mock replaced; email templates use env vars |
| Invoice validation | ✅ Done | dueDate >= issueDate; amount > 0 |
| Phone validation | ✅ Done | Format regex |
| Dead buttons/links | ✅ Done | All 14 found + fixed |
| Workforce Intelligence | ✅ Done | PARTNER-only, 3 new DB tables |
| Proposals & Quotations | ✅ Done | Lead CRM, PDF, email, client portal |
| Enterprise sidebar | ✅ Done | Groups, favorites, recent, quick actions |
| EXECUTIVE→EMPLOYEE rename | ✅ Done | Code complete; DB SQL ready to run |
| Role-specific dashboards | ✅ Done | Partner/Manager/Employee each distinct |
| Role-specific navigation | ✅ Done | getNavigationForRole per role |
| Route hardening | ✅ Done | /activity PARTNER only; CLIENT blocked from all staff routes |
| Data scoping (EMPLOYEE) | ✅ Done | Assigned-only via getEmployeeScopeId |
| Workforce heartbeat | ✅ Done | HeartbeatTracker in AppShell, fires every 5 min |
| CLIENT routing | ✅ Done | 4-layer defence; CLIENT always goes to /client |
| Password reset (PKCE) | ✅ Done | /auth/reset-password/confirm exchanges code before form |
| Firm branding in emails | ✅ Done | All env-var driven; proposals.ts hardcoded fallback also fixed S10 |
| Dead code removed | ✅ Done | 65+ files cleaned; ESLint _-prefix pattern configured |
| **Onboarding wizard** | ✅ Done S10 | 6-step guided setup; employees + client created in DB; progress tracking; contextual guidance |
| **CRUD completeness** | ✅ Done S10 | All 9 modules verified; 7 bugs fixed including missing deleteInvoice |
| **Form validation** | ✅ Done S10 | 14 forms audited; 7 issues fixed; canSubmit guards, complexity policy, render-body bug |
| **90-day simulation** | ✅ Done S11 | Seed: 10 emp / 100 clients / 500 tasks / 200 invoices / 1000 notifs; 5 workflow bugs fixed |
| **Task assignment notifications** | ✅ Done S11 | createTask now inserts TASK_ASSIGNED notification for assigned employee |
| **Payment received notifications** | ✅ Done S11 | recordPayment now inserts PAYMENT_RECEIVED notifications for PARTNER/MANAGER |
| **EMPLOYEE compliance workflow** | ✅ Done S11 | Employees can now update workflow status for their assigned clients |
| **Notification RBAC** | ✅ Done S11 | createNotification RBAC fixed; PARTNER/MANAGER can notify any user |
| **Client code race condition** | ✅ Done S11 | generateClientCode runs inside transaction to prevent duplicate codes |
| **Role migration (DB)** | ✅ Done S12 | EXECUTIVE removed from DB enum via prisma db push; migration SQL idempotent |
| **FirmSettings DB model** | ✅ Done S12 | Singleton table; PARTNER configures in Settings; env-var fallback for fresh installs |
| **Dynamic email branding** | ✅ Done S12 | resend-provider reads from DB on every send; no restart needed after settings change |
| **Settings PARTNER-only guard** | ✅ Done S12 | Firm Details card only rendered for PARTNER; saveFirmSettings() uses requirePartner() |
| **RLS SQL generated** | ✅ Done S12 | 002_rls_policies.sql covers 12 tables; run in Supabase SQL editor to activate |
| **Dev artifacts removed** | ✅ Done S12 | 22 QA reports deleted; test-client-master.ts deleted; seedEmployeesIfEmpty removed |
| **EMPLOYEE onboarding bypass** | ✅ Done S12 | EMPLOYEE goes straight to dashboard; wizard only for PARTNER/MANAGER |
| Automated tests | ❌ None | No Jest/Vitest/Playwright |
| RLS activation | ⚠️ Pending | SQL generated; must be run in Supabase SQL editor to take effect |

---

## 8. REMAINING WORK (priority order)

### CRITICAL — Before First Production User
1. **Configure Firm Settings** — Log in as PARTNER → Settings → Firm Details. Set firm name and sender email. Without a valid `fromEmail`, email sends will fail silently.
2. **Activate RLS** — Run `prisma/migrations-manual/002_rls_policies.sql` in Supabase SQL editor. Until then, direct API calls bypass application-layer guards.
3. **Verify Resend sender domain** — The `fromEmail` configured in Firm Settings must be a verified domain/address in the Resend dashboard.

### HIGH — Security
4. **Upstash Redis rate limiter** — In-memory rate limiter resets on serverless cold starts. Migration path documented in `lib/security/rate-limiter.ts`.

### MEDIUM — Testing
5. **Playwright E2E test suite** — No automated tests. Priority scenarios: CLIENT cannot access `/`, EMPLOYEE cannot access `/payments`, EMPLOYEE sees only assigned clients, PARTNER sees all data, password reset end-to-end.

### LOW — Quality
6. **WhatsApp Business API** — Set `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` in `.env` to enable real WhatsApp messaging.
7. **Supabase `documents` bucket** — Verify exists in Supabase dashboard; `assertDocumentBucketExists()` creates on first upload automatically.

---

## 9. GIT LOG (last 10 commits)

```
24cae80  docs: update all three state documents for session 9 stabilization + auth hardening
2771159  chore: remove stale lint output files
fee4c6f  fix(auth): harden authentication flows — CLIENT isolation + password reset
38e028b  fix(mock-data): eliminate all mock/fake data from production code
dd509e9  fix(stabilize): dead code sweep + workforce heartbeat + lint hygiene
c20489c  fix(lint): resolve all 12 ESLint errors for production launch
c8799dc  docs: update all three state documents for session 8 RBAC restructuring
3ef1efa  feat(rbac): enterprise RBAC restructuring — EXECUTIVE→EMPLOYEE, route hardening, role dashboards
6e99e3a  feat(nav): enterprise sidebar with grouped categories, favorites, recent items & quick actions
ac951d0  docs: fix stale commit hash, git log, env vars, and repo structure in PROJECT_STATE
```

> Session 10 changes are uncommitted (onboarding overhaul, CRUD fixes, form validation). Commit with: `git add -A && git commit -m "feat(ux): onboarding overhaul + CRUD verification + form validation hardening"`

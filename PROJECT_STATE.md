# J-TAX — Complete Project State Document

**Last updated:** 2026-06-10 (Session 8 — Enterprise RBAC Restructuring & Hardening)
**Branch:** `main`
**Last commit:** `3ef1efa` — feat(rbac): enterprise RBAC restructuring
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
- WhatsApp + email messaging (via Resend)
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

## 3. ROLE STRUCTURE (as of Session 8)

| Role | Level | Represents | Key restrictions |
|------|-------|------------|-----------------|
| `PARTNER` | 3 | Firm owner, Managing Partner, Senior CA | Full access |
| `MANAGER` | 2 | Team Lead, Department Head, Senior CA | No audit logs, no workforce, no firm revenue analytics |
| `EMPLOYEE` | 1 | Accountant, Tax Associate, Article | Assigned data only; no payments, employees, reports, proposals, audit logs |
| `CLIENT` | 0 | End client | Client portal only |

> **⚠️ DB Migration Required:** Run `prisma/migrations-manual/001_rename_executive_to_employee.sql` once in Supabase SQL editor before using the app with real data. This renames the `EXECUTIVE` enum value to `EMPLOYEE`.

---

## 4. ROUTE ACCESS MATRIX

| Route | PARTNER | MANAGER | EMPLOYEE | CLIENT |
|-------|---------|---------|----------|--------|
| `/` | ✅ | ✅ | ✅ | ❌ |
| `/clients` | ✅ All | ✅ All | ✅ Assigned only | ❌ |
| `/work-tracker` | ✅ All | ✅ All | ✅ Assigned only | ❌ |
| `/compliance` | ✅ All | ✅ All | ✅ Assigned only | ❌ |
| `/calendar` | ✅ | ✅ | ✅ | ❌ |
| `/documents` | ✅ | ✅ | ✅ | ❌ |
| `/messaging` | ✅ | ✅ | ✅ | ❌ |
| `/notifications` | ✅ | ✅ | ✅ | ❌ |
| `/settings` | ✅ | ✅ | ✅ | ❌ |
| `/payments` | ✅ | ✅ | 🔒 | ❌ |
| `/payments/invoices` | ✅ | ✅ | 🔒 | ❌ |
| `/employees` | ✅ | ✅ | 🔒 | ❌ |
| `/reports` | ✅ | ✅ | 🔒 | ❌ |
| `/proposals` | ✅ | ✅ | 🔒 | ❌ |
| `/activity` (audit) | ✅ | 🔒 | 🔒 | ❌ |
| `/workforce` | ✅ | 🔒 | 🔒 | ❌ |

---

## 5. REPOSITORY STRUCTURE (key files only)

```
j-tax/
├── app/
│   ├── (app)/
│   │   ├── page.tsx                  # UPDATED S8 — role-specific dashboard routing
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
│   │   ├── settings/page.tsx
│   │   └── layout.tsx
│   ├── (auth)/login, signup, reset-password
│   ├── (client-portal)/client/
│   ├── actions/
│   │   ├── auth.ts, clients.ts, employees.ts
│   │   ├── tasks.ts                  # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   │   ├── compliance.ts             # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   │   ├── documents.ts              # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   │   ├── messages.ts               # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   │   ├── search.ts                 # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   │   ├── activity.ts               # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   │   ├── invoices.ts, reports.ts, onboarding.ts
│   │   ├── workforce.ts
│   │   ├── proposals.ts
│   │   ├── settings.ts
│   │   ├── client-360.ts             # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   │   └── client-portal-documents.ts
│   ├── (quotation-portal)/q/[token]/
│   ├── api/
│   ├── unauthorized/page.tsx
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── dashboard/
│   │   ├── partner-command-center.tsx  # NEW S8 — revenue, approvals, high-risk
│   │   ├── manager-dashboard.tsx       # NEW S8 — team workload, SLA, urgent items
│   │   ├── employee-dashboard.tsx      # NEW S8 — personal tasks, clients, compliance
│   │   ├── executive-summary.tsx       # "Executive Summary" widget (business term)
│   │   ├── setup-checklist.tsx
│   │   └── kpi-cards.tsx, revenue-chart.tsx, filing-chart.tsx, etc.
│   ├── layout/
│   │   ├── app-sidebar.tsx             # UPDATED S7/S8 — enterprise sidebar
│   │   └── app-shell.tsx              # defaultOpen=true
│   ├── work-tracker/
│   │   └── task-detail-drawer.tsx     # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   ├── clients/
│   ├── messaging/
│   └── settings/
├── lib/
│   ├── auth/
│   │   ├── types.ts                   # UPDATED S8 — EMPLOYEE replaces EXECUTIVE
│   │   ├── roles.ts                   # UPDATED S8 — RBAC matrix, /activity PARTNER-only
│   │   ├── scope.ts                   # UPDATED S8 — getEmployeeScopeId, isEmployee
│   │   ├── guards.ts                  # requireAuth, requirePartner, requirePartnerOrManager
│   │   └── session.ts
│   ├── stores/
│   │   └── sidebar-store.ts           # NEW S7 — Zustand persist: favorites, recent, groups
│   ├── navigation.ts                  # UPDATED S7/S8 — getNavigationForRole(role)
│   ├── clients/
│   │   └── queries.ts                 # UPDATED S8 — EXECUTIVE→EMPLOYEE
│   └── validations/, workforce/, quotations/, etc.
├── prisma/
│   ├── schema.prisma                  # UPDATED S8 — Role enum EMPLOYEE (was EXECUTIVE)
│   └── migrations-manual/
│       └── 001_rename_executive_to_employee.sql  # NEW S8 — run once in Supabase
├── proxy.ts                           # Middleware: enforces canAccessRoute at edge
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
- `FROM_EMAIL` ✅
- `NEXT_PUBLIC_APP_URL` ✅ (http://localhost:3000)
- `CRON_SECRET` ✅ (random hex)
- `FIRM_NAME` ⚠️ Optional — defaults to "TaxWise Consultants" in PDF/emails
- `FIRM_PHONE` ⚠️ Optional — defaults to "+91-XXXXXXXXXX"
- `FIRM_ADDRESS` ⚠️ Optional — defaults to "India"

---

## 7. TESTING STATUS

| Area | Status | Notes |
|------|--------|-------|
| Production build | ✅ Passes | 42 routes, 0 errors |
| TypeScript strict mode | ✅ Passes | 0 errors |
| Login/auth flow | ✅ Manual | |
| All major pages | ✅ Manual | |
| Setup checklist | ✅ Done | Live DB counts |
| Employee enable/disable | ✅ Done | Actions + UI wired |
| Client portal upload | ✅ Done | Signed URL + XHR progress |
| Dashboard caching | ✅ Done | 60s unstable_cache per role |
| CI/CD | ✅ Done | GitHub Actions |
| Notification prefs | ✅ Done | Saved to user_metadata |
| Onboarding data | ✅ Done | All steps save to user_metadata |
| Mock data eliminated | ✅ Done | WhatsApp chat + comm history |
| Invoice validation | ✅ Done | dueDate >= issueDate |
| Phone validation | ✅ Done | Format regex |
| Dead buttons/links | ✅ Done | All 14 found + fixed |
| Workforce Intelligence | ✅ Done | PARTNER-only, 3 new DB tables |
| Proposals & Quotations | ✅ Done | Lead CRM, PDF, email, client portal |
| Enterprise sidebar | ✅ Done | S7 — groups, favorites, recent, quick actions |
| EXECUTIVE→EMPLOYEE rename | ✅ Done | S8 — code complete; DB SQL ready to run |
| Role-specific dashboards | ✅ Done | S8 — Partner/Manager/Employee each distinct |
| Role-specific navigation | ✅ Done | S8 — getNavigationForRole per role |
| Route hardening | ✅ Done | S8 — /activity PARTNER only |
| Data scoping (EMPLOYEE) | ✅ Done | S8 — assigned-only via getEmployeeScopeId |
| Automated tests | ❌ None | No Jest/Vitest/Playwright |
| RLS policies | ❌ None | Application-layer auth only |

---

## 8. REMAINING WORK (priority order)

### CRITICAL — Before Production
1. **Run DB migration** — `prisma/migrations-manual/001_rename_executive_to_employee.sql` in Supabase SQL editor. One `ALTER TYPE` statement. Required before any EMPLOYEE-role user logs in.

### HIGH — Security
2. **Supabase RLS policies** — No row-level security. Direct Supabase API calls bypass all application guards. Risk: authenticated users can query any table directly.
3. **Upstash Redis rate limiter** — In-memory rate limiter resets on serverless cold starts.

### MEDIUM — Testing
4. **Playwright E2E test suite** — No automated tests. Priority scenarios: EMPLOYEE cannot access /payments, EMPLOYEE sees only assigned clients, PARTNER sees all data.

### LOW — Quality
5. **ESLint configuration** — CI lint is permissive (`|| true`)
6. **`any` types in Prisma where clauses** — `where: any` in listEmployeesData and others
7. **Supabase `documents` bucket** — Verify in dashboard; `assertDocumentBucketExists()` creates on first upload
8. **WhatsApp Business API** — Configure WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID
9. **Settings page firm-level guard** — Settings route is accessible to all staff but firm name/GSTIN/address fields should be PARTNER-only within the page
10. **Workforce heartbeat** — `recordHeartbeat()` action exists, not wired to client component for IDLE detection

---

## 9. GIT LOG (last 8 commits)

```
3ef1efa  feat(rbac): enterprise RBAC restructuring — EXECUTIVE→EMPLOYEE, route hardening, role dashboards
6e99e3a  feat(nav): enterprise sidebar with grouped categories, favorites, recent items & quick actions
ac951d0  docs: fix stale commit hash, git log, env vars, and repo structure in PROJECT_STATE
cc208bc  docs: update session 6 state documents for proposals system
222c43e  feat(proposals): quotation & proposal automation system
ae17532  feat(workforce): enterprise employee performance & work tracking system
4f5cef7  docs: add session 4 fixes to FIX_LOG.md
abccd21  docs: update state documents after session 4 customer audit
```

# J-TAX — Complete Project State Document

**Last updated:** 2026-06-10 (Session 9 — Production Stabilization, Mock Data Elimination, Auth Hardening)
**Branch:** `main`
**Last commit:** `2771159` — chore: remove stale lint output files
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

## 3. ROLE STRUCTURE (as of Session 8)

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

CLIENT routing is enforced at 4 layers: `signIn` action, `proxy.ts` (auth redirect + access-denied), `(app)/layout.tsx`, `(app)/page.tsx`.

---

## 5. REPOSITORY STRUCTURE (key files only)

```
j-tax/
├── app/
│   ├── (app)/
│   │   ├── page.tsx                  # UPDATED S8/S9 — role dashboards + CLIENT guard
│   │   ├── layout.tsx                # UPDATED S9 — CLIENT role redirect to /client
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
│   │   ├── callback/route.ts         # OAuth / email confirm code exchange
│   │   └── reset-password/confirm/page.tsx  # UPDATED S9 — PKCE code exchange + styled
│   ├── actions/
│   │   ├── auth.ts                   # UPDATED S9 — CLIENT role routing on login
│   │   ├── clients.ts, employees.ts
│   │   ├── tasks.ts, compliance.ts, documents.ts, messages.ts
│   │   ├── search.ts, activity.ts
│   │   ├── invoices.ts, reports.ts, onboarding.ts
│   │   ├── workforce.ts, proposals.ts, settings.ts
│   │   └── client-360.ts, client-portal-documents.ts
│   ├── (quotation-portal)/q/[token]/  # UPDATED S9 — contact email uses env var
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
│   │   ├── app-shell.tsx             # UPDATED S9 — mounts HeartbeatTracker
│   │   └── heartbeat-tracker.tsx    # NEW S9 — recordHeartbeat() every 5 min
│   ├── work-tracker/
│   ├── clients/
│   ├── messaging/
│   └── settings/
├── lib/
│   ├── auth/
│   │   ├── types.ts
│   │   ├── roles.ts                  # UPDATED S9 — STAFF_ROLES; CLIENT removed from staff routes; /client added
│   │   ├── scope.ts
│   │   ├── guards.ts
│   │   └── session.ts
│   ├── messaging/
│   │   ├── whatsapp-api.ts           # UPDATED S9 — real Meta Cloud API, no mock
│   │   ├── resend-provider.ts        # UPDATED S9 — all branding uses env vars
│   │   ├── notification-service.ts
│   │   └── provider-interface.ts
│   ├── stores/
│   │   └── sidebar-store.ts
│   ├── navigation.ts
│   ├── clients/
│   │   └── queries.ts
│   └── validations/, workforce/, quotations/, etc.
├── prisma/
│   ├── schema.prisma
│   └── migrations-manual/
│       └── 001_rename_executive_to_employee.sql
├── proxy.ts                           # UPDATED S9 — CLIENT routing, 4-layer defence
├── eslint.config.mjs                  # UPDATED S9 — _-prefix ignore pattern
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
| ESLint | ✅ Passes | 0 errors, 261 warnings (all `warn`, not `error`) |
| Login/auth flow | ✅ Manual | |
| All major pages | ✅ Manual | |
| Setup checklist | ✅ Done | Live DB counts |
| Employee enable/disable | ✅ Done | Actions + UI wired |
| Client portal upload | ✅ Done | Signed URL + XHR progress |
| Dashboard caching | ✅ Done | 60s unstable_cache per role |
| CI/CD | ✅ Done | GitHub Actions |
| Notification prefs | ✅ Done | Saved to user_metadata |
| Onboarding data | ✅ Done | All steps save to user_metadata |
| Mock data eliminated | ✅ Done | lib/dashboard-data.ts, lib/clients-data.ts deleted; WhatsApp mock replaced; email templates use env vars |
| Invoice validation | ✅ Done | dueDate >= issueDate |
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
| Firm branding in emails | ✅ Done | All env-var driven; no hardcoded "TaxWise Consultants" |
| Dead code removed | ✅ Done | 65+ files cleaned; ESLint _-prefix pattern configured |
| Automated tests | ❌ None | No Jest/Vitest/Playwright |
| RLS policies | ❌ None | Application-layer auth only |

---

## 8. REMAINING WORK (priority order)

### CRITICAL — Before Production
1. **Run DB migration** — `prisma/migrations-manual/001_rename_executive_to_employee.sql` in Supabase SQL editor. Required before any EMPLOYEE-role user logs in.
2. **Set `FIRM_NAME` env var** — Currently defaults to "Your Tax Firm" in all outbound emails and PDFs. Set to actual firm name in Vercel/prod env.

### HIGH — Security
3. **Supabase RLS policies** — No row-level security. Direct Supabase API calls bypass all application guards. Risk: authenticated users can query any table directly.
4. **Upstash Redis rate limiter** — In-memory rate limiter resets on serverless cold starts.

### MEDIUM — Testing
5. **Playwright E2E test suite** — No automated tests. Priority scenarios: CLIENT cannot access `/`, EMPLOYEE cannot access `/payments`, EMPLOYEE sees only assigned clients, PARTNER sees all data.

### LOW — Quality
6. **Settings page firm-level guard** — `/settings` accessible to all staff, but firm name/GSTIN/address fields should be PARTNER-only within the page.
7. **WhatsApp Business API** — Set `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` in `.env` to enable real WhatsApp messaging. Banner in `whatsapp-chat.tsx` already handles the unconfigured state.
8. **Supabase `documents` bucket** — Verify in dashboard; `assertDocumentBucketExists()` creates on first upload.

---

## 9. GIT LOG (last 10 commits)

```
2771159  chore: remove stale lint output files
fee4c6f  fix(auth): harden authentication flows — CLIENT isolation + password reset
38e028b  fix(mock-data): eliminate all mock/fake data from production code
dd509e9  fix(stabilize): dead code sweep + workforce heartbeat + lint hygiene
c20489c  fix(lint): resolve all 12 ESLint errors for production launch
c8799dc  docs: update all three state documents for session 8 RBAC restructuring
3ef1efa  feat(rbac): enterprise RBAC restructuring — EXECUTIVE→EMPLOYEE, route hardening, role dashboards
6e99e3a  feat(nav): enterprise sidebar with grouped categories, favorites, recent items & quick actions
ac951d0  docs: fix stale commit hash, git log, env vars, and repo structure in PROJECT_STATE
cc208bc  docs: update session 6 state documents for proposals system
```

# J-TAX — Complete Project State Document

**Last updated:** 2026-06-10 (Session 8 — Enterprise RBAC Restructuring & Hardening)
**Branch:** `main`
**Last commit:** see `git log` — feat(nav): enterprise sidebar with groups, favorites, recent items
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
- Employee/team management
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
| State | Zustand 5 | client onboarding wizard |
| Forms | React Hook Form 7 + Zod 4 | — |
| Email | Resend | `resend` 6.x |
| Storage | Supabase Storage | — |
| Charts | Recharts 2 | — |
| Animation | Framer Motion 11 | — |
| Export | pdfkit + xlsx | — |
| Package manager | npm 11.6.2 | — |

---

## 3. REPOSITORY STRUCTURE (key files only)

```
j-tax/
├── app/
│   ├── (app)/
│   │   ├── page.tsx                  # Dashboard with setup checklist + 60s cache
│   │   ├── clients/page.tsx          # Single PageHeader (fixed dupe)
│   │   ├── employees/page.tsx
│   │   ├── proposals/page.tsx            # NEW — Leads CRM + Quotations + Analytics
│   │   ├── proposals/quotations/new/page.tsx  # NEW — quotation builder
│   │   ├── proposals/quotations/[id]/page.tsx # NEW — quotation detail + approve/send
│   │   ├── workforce/page.tsx            # PARTNER-only workforce dashboard
│   │   ├── workforce/[employeeId]/page.tsx  # NEW — employee detail + timeline
│   │   ├── work-tracker/
│   │   ├── compliance/
│   │   ├── payments/invoices/
│   │   ├── documents/
│   │   ├── messaging/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── settings/page.tsx         # Now async — loads notification prefs
│   │   └── layout.tsx
│   ├── (auth)/login, signup, reset-password
│   ├── (client-portal)/client/
│   │   └── documents/ (upload-form.tsx + download-button.tsx)
│   ├── actions/
│   │   ├── auth.ts, clients.ts, employees.ts, tasks.ts
│   │   ├── compliance.ts, documents.ts, invoices.ts
│   │   ├── messages.ts, notifications.ts, onboarding.ts
│   │   ├── reports.ts, search.ts, activity.ts
│   │   ├── workforce.ts                  # analytics, timeline, attendance, alerts
│   │   ├── proposals.ts                  # NEW — lead CRM, quotation CRUD, analytics
│   │   ├── settings.ts               # saveNotificationPreferences + getNotificationPreferences
│   │   ├── client-360.ts
│   │   └── client-portal-documents.ts
│   ├── (quotation-portal)/q/[token]/   # Public client quotation portal (no auth)
│   ├── api/ (clients, auth/callback, cron/payments, cron/quotation-followups, quotations/[id]/pdf)
│   ├── unauthorized/page.tsx
│   ├── error.tsx                     # Safe generic message (no raw error.message)
│   └── not-found.tsx
├── components/
│   ├── dashboard/
│   │   └── setup-checklist.tsx       # NEW — 6-step setup wizard widget
│   ├── clients/
│   │   ├── clients-empty-state.tsx   # Dead button removed, guidance text added
│   │   └── client-onboarding-wizard.tsx
│   ├── empty-states/empty-states.tsx # All 9 dead hrefs fixed with real routes/callbacks
│   ├── messaging/
│   │   ├── whatsapp-chat.tsx         # Mock messages removed; real empty state
│   │   └── client-communication-history.tsx  # Real DB data via getClientCommunicationHistory
│   └── settings/settings-page-client.tsx  # Notification prefs now save/load
├── .github/workflows/ci.yml
├── vercel.json
├── lib/stores/
│   └── sidebar-store.ts              # NEW — Zustand persist: favorites, recent items, group collapse
├── lib/navigation.ts                 # UPDATED — NavGroup type, 5 category groups, filterGroupsByRole
├── components/layout/
│   ├── app-sidebar.tsx               # REWRITTEN — enterprise sidebar with all features
│   └── app-shell.tsx                 # UPDATED — defaultOpen=true
└── lib/validations/
    ├── client.ts                     # Phone/WhatsApp format validation added
    └── invoice.ts                    # dueDate >= issueDate cross-field validation
```

---

## 4. ENVIRONMENT VARIABLES — CURRENT STATUS

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

## 5. TESTING STATUS

| Area | Status | Notes |
|------|--------|-------|
| Production build | ✅ Passes | 42 routes, 0 errors |
| TypeScript strict mode | ✅ Passes | 0 errors |
| Login/auth flow | ✅ Manual | |
| All major pages | ✅ Manual | |
| Setup checklist | ✅ Done | Live DB counts |
| Employee enable/disable | ✅ Done | Actions + UI wired |
| Client portal upload | ✅ Done | Signed URL + XHR progress |
| Dashboard caching | ✅ Done | 60s unstable_cache |
| CI/CD | ✅ Done | GitHub Actions |
| Notification prefs | ✅ Done | Saved to user_metadata |
| Onboarding data | ✅ Done | All steps save to user_metadata |
| Mock data eliminated | ✅ Done | WhatsApp chat + comm history |
| Invoice validation | ✅ Done | dueDate >= issueDate |
| Phone validation | ✅ Done | Format regex |
| Dead buttons/links | ✅ Done | All 14 found + fixed |
| Workforce Intelligence | ✅ Done | PARTNER-only, 3 new DB tables, full tracking |
| Proposals & Quotations | ✅ Done | Lead CRM, PDF, email automation, client portal |
| Automated tests | ❌ None | No Jest/Vitest/Playwright |
| RLS policies | ❌ None | Application-layer auth only |

---

## 6. REMAINING WORK (priority order)

### HIGH — Security
1. **Supabase RLS policies** — No DB-level protection
2. **Upstash Redis rate limiter** — In-memory resets on cold starts

### MEDIUM — Testing
3. **Playwright E2E test suite** — No automated tests

### LOW — Quality
4. **ESLint configuration** — CI lint is permissive (`|| true`)
5. **`any` types in Prisma where clauses**
6. **Supabase `documents` bucket** — Check dashboard, may need manual creation
7. **WhatsApp Business API** — Configure WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID

---

## 7. GIT LOG (last 8 commits)

```
cc208bc  docs: update session 6 state documents for proposals system
222c43e  feat(proposals): quotation & proposal automation system
ae17532  feat(workforce): enterprise employee performance & work tracking system
4f5cef7  docs: add session 4 fixes to FIX_LOG.md
abccd21  docs: update state documents after session 4 customer audit
e2136bf  fix(audit): phases 3-6 — mock data, validations, production readiness
6e7f386  fix(audit): dead buttons, onboarding data, setup checklist
19c8a91  fix: startup blockers, 19 security fixes, toUserError across all actions
```

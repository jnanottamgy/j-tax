# J-TAX — Complete Project State Document

**Generated:** 2026-06-09  
**Session:** Initial engineering + security audit + remediation  
**Branch:** `main`  
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

## 3. REPOSITORY STRUCTURE

```
j-tax/
├── app/                          # Next.js App Router
│   ├── (app)/                    # Protected staff routes (PARTNER/MANAGER/EXECUTIVE)
│   │   ├── page.tsx              # Dashboard (13 parallel DB queries)
│   │   ├── clients/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx     # Client 360 view
│   │   ├── work-tracker/page.tsx # Kanban board
│   │   ├── compliance/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── payments/
│   │   │   ├── page.tsx          # Payments dashboard
│   │   │   └── invoices/
│   │   │       ├── page.tsx
│   │   │       └── [id]/page.tsx
│   │   ├── documents/page.tsx    # Document vault
│   │   ├── employees/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── messaging/page.tsx    # WhatsApp + email
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   └── export/route.ts   # CSV/XLSX/PDF API route
│   │   ├── notifications/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── activity/page.tsx
│   │   └── layout.tsx            # Auth check + AppShell
│   ├── (auth)/                   # Public auth pages
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── layout.tsx
│   ├── (client-portal)/          # CLIENT-role portal (separate UI)
│   │   └── client/
│   │       ├── page.tsx
│   │       ├── compliance/page.tsx
│   │       ├── documents/
│   │       │   ├── page.tsx
│   │       │   └── download-button.tsx  # NEW (security fix)
│   │       ├── invoices/page.tsx
│   │       ├── messages/page.tsx
│   │       ├── deadlines/page.tsx
│   │       └── layout.tsx
│   ├── actions/                  # Server Actions (15 files)
│   │   ├── auth.ts               # signIn, signUp, resetPassword, signOut
│   │   ├── clients.ts            # CRUD + onboarding
│   │   ├── employees.ts          # CRUD + enable/disable (TODO: enable/disable not implemented)
│   │   ├── tasks.ts              # Work tracker CRUD
│   │   ├── compliance.ts         # Compliance event CRUD
│   │   ├── documents.ts          # Upload/download/rename/delete
│   │   ├── invoices.ts           # Invoice + payment receipt CRUD
│   │   ├── payments.ts           # Payment tracking
│   │   ├── messages.ts           # WhatsApp/email send
│   │   ├── notifications.ts      # In-app notifications
│   │   ├── onboarding.ts         # User onboarding wizard
│   │   ├── reports.ts            # Report data fetching
│   │   ├── search.ts             # Global search
│   │   ├── activity.ts           # Activity timeline
│   │   └── client-360.ts         # Client 360 view data
│   ├── api/                      # API Routes
│   │   ├── clients/route.ts      # GET (list), POST (create)
│   │   ├── clients/[id]/route.ts # GET (detail), PATCH (update)
│   │   ├── auth/callback/route.ts
│   │   ├── auth/reset-password/confirm/route.ts
│   │   └── cron/payments/route.ts  # Overdue invoice processor
│   ├── auth/callback/route.ts
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── unauthorized.tsx
│   └── layout.tsx                # Root layout (fonts, Toaster)
├── components/
│   ├── ui/                       # 25+ Shadcn UI primitives
│   ├── auth/                     # AuthProvider, RoleGuard, login/signup forms
│   ├── dashboard/                # KPI cards, charts, widgets
│   ├── layout/                   # AppShell, AppSidebar, PageContainer
│   ├── clients/                  # ClientsTable, dialogs, badges
│   ├── work-tracker/             # KanbanBoard, TaskTable, dialogs
│   ├── compliance/               # Calendar, agenda, dialogs
│   ├── documents/                # Grid/list/upload/modal
│   ├── payments/                 # InvoicesPage, dialogs
│   ├── messaging/                # Dashboard, chat, template builder
│   ├── employees/                # Table, add dialog
│   ├── notifications/            # Bell, provider, client
│   ├── onboarding/               # Wizard, guided tour, help center
│   ├── command-palette/          # Global ⌘K search
│   ├── activity/                 # Timeline
│   ├── error/                    # ErrorBoundary
│   ├── forms/                    # FormField, FormAlert, SubmitButton
│   ├── empty-states/
│   └── client-portal/            # ClientSidebar, ClientHeader
├── hooks/
│   ├── use-mobile.ts
│   └── use-validated-form.ts
├── lib/
│   ├── auth/
│   │   ├── session.ts            # getSession(), requireSession() — uses supabase.auth.getUser()
│   │   ├── roles.ts              # RBAC: canAccessRoute(), hasRole(), ROLE_LEVEL
│   │   ├── guards.ts             # requireAuth(), requirePartnerOrManager(), etc.
│   │   ├── scope.ts              # getExecutiveEmployeeId(), canAccessAssignedClient()
│   │   ├── types.ts              # AppRole, AuthUser, SessionInfo
│   │   └── utils.ts
│   ├── supabase/
│   │   ├── client.ts             # createBrowserClient (@supabase/ssr)
│   │   ├── server.ts             # createServerClient (@supabase/ssr)
│   │   ├── middleware.ts         # updateSession() for proxy.ts
│   │   └── env.ts                # getSupabaseUrl(), getSupabaseAnonKey() — STATIC refs
│   ├── security/
│   │   ├── rate-limiter.ts       # In-memory (needs Redis for prod)
│   │   ├── audit-logger.ts       # logLoginSuccess/Failure, logAuditEvent
│   │   └── index.ts
│   ├── storage/storage.ts        # Supabase Storage helpers
│   ├── messaging/
│   │   ├── notification-service.ts
│   │   ├── resend-provider.ts    # Email via Resend
│   │   ├── whatsapp-api.ts       # WhatsApp Business API (keys not configured)
│   │   └── provider-interface.ts
│   ├── notifications/            # Possibly redundant with lib/messaging — not imported
│   ├── clients/
│   │   ├── queries.ts            # listClients, createClientWithOnboarding, etc.
│   │   ├── onboarding.ts         # buildOnboardingArtifacts()
│   │   ├── onboarding-store.ts   # Zustand store (localStorage)
│   │   └── types.ts
│   ├── validations/              # Zod schemas: auth, client, employee, task, invoice, message, settings
│   ├── activity/logger.ts
│   ├── forms/
│   │   ├── types.ts
│   │   └── errors.ts             # flattenFieldErrors, toUserError() [new]
│   ├── employees/types.ts
│   ├── ui/                       # tokens.ts, animations.ts
│   ├── prisma.ts                 # Prisma singleton with @prisma/adapter-pg
│   ├── utils.ts                  # cn() (clsx + tailwind-merge)
│   ├── navigation.ts             # Nav structure + role filtering
│   ├── dashboard-data.ts
│   └── clients-data.ts
├── prisma/
│   ├── schema.prisma             # 27 models, 735 lines
│   ├── seed.ts                   # Orchestrator → operational-seed.ts [new]
│   ├── operational-seed.ts       # Generates 100 clients, 10 employees, 500 tasks, etc.
│   ├── seed-tasks.ts
│   ├── seed-invoices.ts
│   ├── seed-compliance-clients.ts
│   ├── seed-notifications.ts
│   ├── seed-search-test.ts
│   └── prisma.config.ts          # (root level)
├── scripts/                      # Utility/verification scripts (run with tsx)
│   ├── test-email-config.ts
│   ├── test-email-system.ts
│   ├── runtime-verification.ts
│   ├── verify-reports.ts
│   ├── update-overdue-invoices.ts
│   └── verify-storage.mjs
├── public/                       # Static assets
├── .claude/launch.json           # Preview server config [new]
├── proxy.ts                      # Next.js 16 middleware (replaces middleware.ts)
├── next.config.ts                # Security headers via getSecurityHeaders()
├── tailwind.config.ts
├── prisma.config.ts
├── tsconfig.json                 # strict: true, paths: @/*
├── package.json
├── .env                          # NOT committed to git
├── .env.example                  # Fully documented [updated]
└── components.json               # Shadcn config
```

---

## 4. DATABASE SCHEMA

**Connection:** PostgreSQL on Supabase  
**ORM:** Prisma 7 with `@prisma/adapter-pg` (Driver Adapters mode)  
**Status:** In sync with schema (no pending migrations needed)

### Tables & Current Row Counts

| Table | Rows | Notes |
|-------|------|-------|
| `User` | 2 | Supabase auth users mirrored here |
| `clients` | 100 | Seeded via operational-seed.ts |
| `employees` | 10 | Seeded |
| `tasks` | 500 | Seeded |
| `invoices` | 200 | Seeded |
| `notifications` | 1000 | Seeded |
| `compliance_events` | 1076 | Seeded |
| `documents` | 0 | No uploads yet |

### 27 Prisma Models

```
User              → Employee (1:1 optional via userId)
Employee          → Client[] (assignedEmployee)
Employee          → Task[] (assignedEmployee)
Client            → ClientService[], Task[], ComplianceSchedule[], ComplianceEvent[]
                    Document[], Invoice[], Message[], Notification[], ActivityLog[]
                    Reminder[]
Invoice           → PaymentReceipt[], FollowUp[], InvoiceReminder[]
Message           → MessageLog[]
MessageTemplate   (standalone, referenced by Message)
Document          → DocumentVersion[], DocumentTag[], DocumentActivity[]
ComplianceEvent   → Task (optional link)
AuditLog          (standalone security audit table)
Reminder          (polymorphic: task/compliance/invoice)
TaskComment       → Task
TaskAttachment    → Task
TaskAutomation    → Task
```

### Key Enums (PostgreSQL)

```
Role:              PARTNER | MANAGER | EXECUTIVE | CLIENT
ClientStatus:      ACTIVE | INACTIVE | PENDING | ON_HOLD
ClientPriority:    LOW | MEDIUM | HIGH | CRITICAL
ServiceType:       GST_RETURN | INCOME_TAX | TDS | PAYROLL | BOOKKEEPING | AUDIT | COMPANY_LAW | OTHER
TaskStatus:        NOT_STARTED | IN_PROGRESS | DATA_AWAITED | UNDER_REVIEW | FILED_DONE | ON_HOLD
TaskPriority:      LOW | MEDIUM | HIGH | URGENT
InvoiceStatus:     DRAFT | SENT | PAID | PARTIALLY_PAID | OVERDUE | DISPUTED | WAIVED
ComplianceType:    GSTR_1 | GSTR_3B | TDS | ROC | ITR | PF_ESIC | AUDIT | CUSTOM
NotificationType:  TASK_ASSIGNED | COMPLIANCE_DUE | PAYMENT_RECEIVED | TASK_OVERDUE | ...
```

### Critical Prisma Notes

- **Driver Adapter mode:** `lib/prisma.ts` uses `PrismaPg(new pg.Pool(...))` — NOT classic Prisma binary engine. Scripts must load `.env` manually (`import 'dotenv/config'`) or DATABASE_URL is undefined.
- **No migrations directory:** Schema managed via `prisma db push`. No `prisma/migrations/` folder exists. To baseline: `prisma migrate diff --from-empty --to-schema-datamodel`.
- **Table name mapping:** `User` model maps to `"User"` table (PascalCase, quoted). Other models map to snake_case via `@@map`.
- **Seed entry point:** `prisma/seed.ts` → imports `operational-seed.ts`. Run: `npm run db:seed`.

---

## 5. SUPABASE CONFIGURATION

**Project ref:** `xksanwabjeatskyqwdbg`  
**URL:** `https://xksanwabjeatskyqwdbg.supabase.co`

### Auth Settings (verified)
- Email/password: ✅ enabled
- Email confirmation: ✅ required (verify in Supabase dashboard)
- OAuth providers: ❌ all disabled
- Role stored in: `user_metadata.role` AND `app_metadata.role`
- `app_metadata` takes precedence in `session.ts:mapSupabaseUser()`

### Role Assignment Flow
```
Supabase Admin creates user → set app_metadata.role = "PARTNER"|"MANAGER"|"EXECUTIVE"|"CLIENT"
→ parseAppRole() reads it in proxy.ts and session.ts
→ User row in "User" table must also exist with matching id and role
```

**CRITICAL:** Both Supabase Auth `app_metadata.role` AND the `User` table row must be set for a user to function. Missing `User` row = onboarding wizard triggers.

### Storage
- Bucket: `documents` (check Supabase dashboard — bucket may need manual creation)
- Access: Signed URLs only (1-hour expiry for downloads)
- Upload: Via server action `uploadDocument()` or signed upload URL flow

### RLS (Row Level Security)
- **NOT CONFIGURED** — no RLS policies exist on any table
- Authorization is handled entirely at the application layer (guards + proxy)
- This is a known gap — RLS would add defense-in-depth for direct DB access

---

## 6. AUTHENTICATION FLOW

```
LOGIN:
  /login → loginSchema (Zod) → checkLoginRateLimit(ip)
  → supabase.auth.signInWithPassword()
  → logLoginSuccess/Failure (audit)
  → isSafeRedirectPath(redirectTo) → redirect

PROXY (proxy.ts — Next.js 16 "middleware"):
  Every request → updateSession() [refreshes Supabase JWT cookie]
  → if no user → redirect /login (with redirectTo param)
  → parseAppRole(user.app_metadata.role ?? user.user_metadata.role)
  → if no role → redirect /unauthorized?reason=missing_role
  → if isAuthRoute && user exists → redirect home (post-login)
  → canAccessRoute(role, pathname) → redirect /unauthorized if denied
  
SESSION VALIDATION (server components):
  layout.tsx → getSession()
  → createClient() [lib/supabase/server.ts]
  → supabase.auth.getUser() [validates token server-side — NOT getSession()]
  → mapSupabaseUser() → { id, email, name, role }

ROLE HIERARCHY:
  PARTNER (3) > MANAGER (2) > EXECUTIVE (1) > CLIENT (0)

ROUTE ACCESS:
  /payments, /reports, /employees → PARTNER or MANAGER only
  /client/* → CLIENT only
  All other protected routes → any authenticated role
```

---

## 7. API ARCHITECTURE

### Routing Convention
- **Server Actions** (`app/actions/*.ts`) — primary mutation path, called from client components
- **API Routes** (`app/api/**`) — used for external integrations (cron, OAuth callback, REST clients)
- All actions start with `requireAuth()` or `requirePartnerOrManager()`

### API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/clients` | requireAuth | List clients (role-scoped) |
| POST | `/api/clients` | requirePartnerOrManager | Create client |
| GET | `/api/clients/[id]` | requireAuth | Client detail (role-scoped) |
| PATCH | `/api/clients/[id]` | requirePartnerOrManager | Update client |
| GET | `/api/auth/callback` | public | Supabase OAuth callback |
| POST | `/api/auth/reset-password/confirm` | public | Password reset exchange |
| GET | `/api/cron/payments` | Bearer CRON_SECRET | Mark overdue invoices |
| GET | `/app/(app)/reports/export/route.ts` | requirePartnerOrManager | Export reports |

### RBAC Guards

```typescript
requireAuth()               // any authenticated user
requireStaff()              // PARTNER | MANAGER | EXECUTIVE
requirePartnerOrManager()   // PARTNER | MANAGER
requirePartner()            // PARTNER only
requireMinimumRole(role)    // role level >= specified
requireClient()             // CLIENT only
```

---

## 8. ENVIRONMENT VARIABLES

### Required (all must be set)

```bash
# Supabase — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Database — Project Settings → Database → URI
DATABASE_URL=postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres

# Supabase admin (server-side only, never expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Email (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com

# App URL — used for email redirect links
NEXT_PUBLIC_APP_URL=https://yourapp.com

# Cron authentication (generate: openssl rand -hex 32)
CRON_SECRET=...
```

### Optional

```bash
# WhatsApp Business API (Meta Business Suite)
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...

# Document upload size limit (default: 25MB)
DOCUMENT_MAX_FILE_SIZE_MB=25
```

### Current `.env` State (dev machine)
- `NEXT_PUBLIC_SUPABASE_URL` ✅ set (fixed: had `/rest/v1/` suffix)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ set
- `DATABASE_URL` ✅ set
- `SUPABASE_SERVICE_ROLE_KEY` ✅ set
- `RESEND_API_KEY` ✅ set
- `FROM_EMAIL` ✅ set (onboarding@resend.dev — Resend test address)
- `NEXT_PUBLIC_APP_URL` ❌ NOT SET — auth emails use origin header fallback
- `CRON_SECRET` ❌ NOT SET — cron endpoint returns 503 until set

---

## 9. CRITICAL ARCHITECTURAL NOTES

### Next.js 16 Breaking Changes
- `middleware.ts` → renamed to `proxy.ts` (export `proxy` function, not `middleware`)
- Config key `experimental.turbo` removed; use top-level `turbopack: {}`
- See `node_modules/next/dist/docs/` for full changelog

### Supabase Client Creation
- **Browser:** `createBrowserClient()` from `@supabase/ssr` (NOT `auth-helpers-nextjs`)
- **Server:** `createServerClient()` from `@supabase/ssr` with cookie store
- **CRITICAL:** `process.env.NEXT_PUBLIC_*` must be referenced STATICALLY (not via `process.env[name]`) for Next.js to inline them into the client bundle. Dynamic access (`process.env[varName]`) returns `undefined` in the browser.

### Prisma Client Instantiation
```typescript
// lib/prisma.ts — MUST use this pattern, not bare new PrismaClient()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
return new PrismaClient({ adapter })
```

### File Upload Security
- `validateUploadFile()` in `app/actions/documents.ts` checks:
  1. MIME type whitelist
  2. File extension matches MIME
  3. Magic bytes (PDF: `%PDF-`, PNG: `0x89 0x50...`, JPEG: `0xFF 0xD8 0xFF`, etc.)
  4. Macro detection for DOCX/XLSX (`vbaProject.bin` scan in first 2MB)
  5. File size ≤ `DOCUMENT_MAX_FILE_SIZE_MB` (default 25MB)

---

## 10. TESTING STATUS

| Area | Status | Notes |
|------|--------|-------|
| Dev server startup | ✅ Passes | `npm run dev` → clean start |
| Production build | ✅ Passes | `npm run build` → 34 routes, 0 errors |
| TypeScript | ✅ Passes | `strict: true`, no errors |
| Prisma generate | ✅ Passes | |
| DB schema sync | ✅ Passes | `prisma db push` → "already in sync" |
| Login/auth flow | ✅ Manual | Tested with `admin@jtax.test` |
| Dashboard | ✅ Manual | Loads with live data |
| Clients list | ✅ Manual | 100 records, search/filter |
| Work Tracker | ✅ Manual | Kanban board renders |
| Compliance | ✅ Manual | 1076 events |
| Payments | ✅ Manual | ₹41.4L outstanding |
| Employees | ✅ Manual | 10 members |
| Reports | ✅ Manual | Charts render |
| Messaging | ✅ Manual | Dashboard loads |
| Settings | ✅ Manual | Profile form renders |
| Open redirect | ✅ Manual | `//evil.com` blocked → 200 login |
| Unauth API | ✅ Manual | `/api/clients` → 401 |
| Cron endpoint | ✅ Manual | No secret → 503, wrong secret → 503 |
| Automated tests | ❌ None | No Jest/Vitest/Playwright configured |
| RLS policies | ❌ None | No Supabase RLS configured |
| CI/CD | ❌ None | No GitHub Actions |

---

## 11. KNOWN PENDING ISSUES

### Functional Gaps
1. **Employee enable/disable** — `TODO.md` documents `disableEmployee()` / `enableEmployee()` actions not implemented. UI has placeholder buttons.
2. **Search history signature changed** — `saveSearchHistory(userId, query)` → `saveSearchHistory(query)`. Any callers passing old signature need updating (check `components/command-palette/command-palette.tsx`).
3. **Client portal upload** — The upload CTA button in `app/(client-portal)/client/documents/page.tsx` is decorative (no action wired). Client-side uploads need an upload action that scopes to the client's own record.
4. **Document bucket** — Supabase `documents` bucket must exist. Check dashboard. `assertDocumentBucketExists()` creates it if missing but may fail without storage permissions.
5. **WhatsApp API** — `lib/messaging/whatsapp-api.ts` requires `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` which are not configured. Messaging currently falls back to email only.

### Security Gaps Remaining
6. **No Supabase RLS** — All authorization is application-layer only. Direct DB access (Supabase dashboard, leaked credentials) bypasses all guards.
7. **In-memory rate limiter** — Resets on Vercel cold starts. Needs Upstash Redis for production brute-force protection.
8. **`NEXT_PUBLIC_APP_URL` not set** — Password reset and email verification links use `origin` header fallback. Set this before sending any auth emails.
9. **`CRON_SECRET` not set** — Cron endpoint returns 503. Add to `.env` before setting up cron jobs.
10. **`lib/notifications/`** — Possible duplicate of `lib/messaging/`. Not imported by anything. Safe to delete.

### Code Quality
11. **`toUserError()` not applied everywhere** — Added to `lib/forms/errors.ts` and applied to `createClient`. Remaining action files still return `error.message` directly. Apply pattern across all catch blocks.
12. **`any` types in Prisma where clauses** — Multiple `where: any` patterns in actions. Should use typed `Prisma.XWhereInput`.
13. **Dashboard 13 parallel queries, no caching** — `(app)/page.tsx` fires 13 DB queries on every visit. Add `unstable_cache` or `cache()`.

---

## 12. COMMANDS REFERENCE

```bash
# Development
npm run dev               # Start dev server (Turbopack, port 3000)
npm run build             # prisma generate + next build
npm run start             # Production server

# Database
npm run db:generate       # prisma generate
npm run db:push           # Push schema to DB (no migration history)
npm run db:studio         # Prisma Studio GUI
npm run db:seed           # Run prisma/seed.ts → operational-seed.ts

# Utility scripts (require dotenv loaded separately)
npx tsx scripts/test-email-config.ts
npx tsx scripts/runtime-verification.ts
npx tsx scripts/verify-storage.mjs
```

---

## 13. SUPABASE PROJECT DETAILS

```
Project ID:    xksanwabjeatskyqwdbg
Region:        (check Supabase dashboard)
DB Host:       db.xksanwabjeatskyqwdbg.supabase.co:5432
DB Name:       postgres
DB User:       postgres
Auth URL:      https://xksanwabjeatskyqwdbg.supabase.co/auth/v1
Storage URL:   https://xksanwabjeatskyqwdbg.supabase.co/storage/v1
```

**Supabase users (Auth):**
1. `jnanbelliappa135@gmail.com` — PARTNER role (original)
2. `admin@jtax.test` — PARTNER role (test user created in this session)

**Database users (User table):**
- Same two users mirrored with `id` matching Supabase Auth UUID

---

## 14. NEXT RECOMMENDED ACTIONS (PRIORITY ORDER)

### Immediate (before going to production)
1. Set `NEXT_PUBLIC_APP_URL` in `.env`
2. Set `CRON_SECRET` in `.env` and configure Vercel Cron or EasyCron
3. Verify Supabase `documents` storage bucket exists
4. Apply `toUserError()` to all remaining action catch blocks
5. Fix `command-palette.tsx` caller of `saveSearchHistory` — remove `userId` param

### Short-term (this week)
6. Implement Supabase RLS policies for core tables
7. Replace in-memory rate limiter with Upstash Redis
8. Implement `disableEmployee()` / `enableEmployee()` (tracked in TODO.md)
9. Wire client portal document upload action
10. Add `NEXT_PUBLIC_APP_URL` validation to startup checks

### Medium-term
11. Add Playwright E2E test suite (at minimum: login, client CRUD, file upload)
12. Set up GitHub Actions CI (lint + build + type-check)
13. Add `vercel.json` with cron schedule for `/api/cron/payments`
14. Configure Supabase email templates (currently using defaults)
15. Implement dashboard query caching via `unstable_cache`

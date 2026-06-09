# J-TAX — Complete Project State Document

**Last updated:** 2026-06-09 (Session 3)
**Branch:** `main`
**Last commit:** `368e8f5` — CI pipeline + Vercel cron config
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
│   ├── (app)/
│   │   ├── page.tsx              # Dashboard — 14 queries, 60s unstable_cache [UPDATED]
│   │   ├── clients/
│   │   ├── work-tracker/
│   │   ├── compliance/
│   │   ├── payments/
│   │   ├── documents/
│   │   ├── employees/            # disableEmployee/enableEmployee fully wired [DONE]
│   │   ├── messaging/
│   │   ├── reports/export/route.ts
│   │   ├── notifications/
│   │   ├── settings/
│   │   ├── activity/
│   │   └── layout.tsx
│   ├── (auth)/                   # login, signup, reset-password
│   ├── (client-portal)/
│   │   └── client/
│   │       ├── documents/
│   │       │   ├── page.tsx              # Upload CTA now wired [DONE]
│   │       │   ├── download-button.tsx   # Signed URL download
│   │       │   └── upload-form.tsx       # NEW — drag-drop + XHR progress [DONE]
│   │       └── layout.tsx
│   ├── actions/
│   │   ├── auth.ts
│   │   ├── clients.ts
│   │   ├── employees.ts           # disableEmployee/enableEmployee fully implemented
│   │   ├── tasks.ts
│   │   ├── compliance.ts
│   │   ├── documents.ts
│   │   ├── invoices.ts
│   │   ├── messages.ts
│   │   ├── notifications.ts
│   │   ├── onboarding.ts
│   │   ├── reports.ts
│   │   ├── search.ts
│   │   ├── activity.ts
│   │   ├── client-360.ts
│   │   ├── settings.ts
│   │   └── client-portal-documents.ts  # NEW — CLIENT upload server actions [DONE]
│   └── api/
│       ├── clients/route.ts
│       ├── clients/[id]/route.ts
│       ├── auth/callback/route.ts
│       ├── auth/reset-password/confirm/route.ts
│       └── cron/payments/route.ts
├── .github/workflows/ci.yml      # NEW — GitHub Actions CI [DONE]
├── vercel.json                   # NEW — Vercel cron + noindex header [DONE]
├── components/                   # (unchanged from session 1)
├── lib/
│   ├── notifications/            # DELETED — was dead code
│   └── ...
├── prisma/schema.prisma          # 27 models, 735 lines
└── ...
```

---

## 4. DATABASE SCHEMA

**Connection:** PostgreSQL on Supabase
**ORM:** Prisma 7 with `@prisma/adapter-pg` (Driver Adapters mode)
**Status:** In sync (no pending migrations)

### Tables & Row Counts

| Table | Rows | Notes |
|-------|------|-------|
| `User` | 2 | admin@jtax.test + jnanbelliappa135@gmail.com |
| `clients` | 100 | Seeded |
| `employees` | 10 | Seeded |
| `tasks` | 500 | Seeded |
| `invoices` | 200 | Seeded |
| `notifications` | 1000 | Seeded |
| `compliance_events` | 1076 | Seeded |
| `documents` | 0 | No uploads yet |

### Critical Prisma Notes
- **Driver Adapter mode:** `lib/prisma.ts` uses `PrismaPg(new pg.Pool(...))` — NOT classic Prisma binary engine
- **No migrations directory:** Schema managed via `prisma db push`
- **Table name mapping:** `User` model maps to `"User"` table (PascalCase, quoted)
- **Seed entry point:** `prisma/seed.ts` → imports `operational-seed.ts`. Run: `npm run db:seed`
- `Document.uploadedBy` is `String` (not optional) — stores `session.user.id`
- `Document.category` is `DocumentCategory` enum — must cast when assigning from string

---

## 5. SUPABASE CONFIGURATION

**Project ref:** `xksanwabjeatskyqwdbg`
**URL:** `https://xksanwabjeatskyqwdbg.supabase.co`

### Auth Settings
- Email/password: ✅ enabled
- Role stored in: `user_metadata.role` AND `app_metadata.role`
- `app_metadata` takes precedence in `session.ts:mapSupabaseUser()`

### Storage
- Bucket: `documents` (check Supabase dashboard — may need manual creation)
- Access: Signed URLs only (1-hour expiry for downloads, 10-min for upload)
- Client-uploaded files go to: `documents/{clientId}/client-uploads/{uuid}-{filename}`

### RLS (Row Level Security)
- **NOT CONFIGURED** — known gap, application-layer auth only

---

## 6. AUTHENTICATION FLOW

```
LOGIN:
  /login → loginSchema (Zod) → checkLoginRateLimit(ip)
  → supabase.auth.signInWithPassword()
  → logLoginSuccess/Failure (audit) → isSafeRedirectPath() → redirect

PROXY (proxy.ts):
  Every request → updateSession() → if no user → /login
  → parseAppRole() → if no role → /unauthorized?reason=missing_role
  → canAccessRoute(role, pathname) → /unauthorized if denied

ROLE HIERARCHY:
  PARTNER (3) > MANAGER (2) > EXECUTIVE (1) > CLIENT (0)

ROUTE ACCESS:
  /payments, /reports, /employees → PARTNER or MANAGER only
  /client/* → CLIENT only
```

---

## 7. ENVIRONMENT VARIABLES

### Current `.env` State (dev machine)
- `NEXT_PUBLIC_SUPABASE_URL` ✅ set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ set
- `DATABASE_URL` ✅ set
- `SUPABASE_SERVICE_ROLE_KEY` ✅ set
- `RESEND_API_KEY` ✅ set
- `FROM_EMAIL` ✅ set (onboarding@resend.dev)
- `NEXT_PUBLIC_APP_URL` ✅ set (http://localhost:3000)
- `CRON_SECRET` ✅ set (random hex, generated session 2)

---

## 8. TESTING STATUS

| Area | Status | Notes |
|------|--------|-------|
| Dev server startup | ✅ Passes | |
| Production build | ✅ Passes | 34 routes, 0 errors |
| TypeScript | ✅ Passes | strict mode |
| Login/auth flow | ✅ Manual | |
| All major pages | ✅ Manual | |
| Open redirect | ✅ Manual | blocked |
| Unauth API | ✅ Manual | 401 |
| Cron endpoint | ✅ Manual | 503 without secret |
| Employee enable/disable | ✅ Wired | actions + UI complete |
| Client portal upload | ✅ Wired | signed URL flow + XHR progress |
| Dashboard caching | ✅ Done | 60s unstable_cache per user |
| CI/CD | ✅ Done | GitHub Actions ci.yml |
| Automated tests | ❌ None | No Jest/Vitest/Playwright |
| RLS policies | ❌ None | No Supabase RLS configured |

---

## 9. CRITICAL ARCHITECTURAL NOTES

### Next.js 16 Breaking Changes
- `middleware.ts` → renamed to `proxy.ts` (export `proxy` function)
- Config key `experimental.turbo` removed; use top-level `turbopack: {}`

### Supabase Client Creation
- **Browser:** `createBrowserClient()` from `@supabase/ssr`
- **Server:** `createServerClient()` from `@supabase/ssr` with cookie store
- **CRITICAL:** `process.env.NEXT_PUBLIC_*` must be referenced STATICALLY

### Prisma Client Instantiation
```typescript
// lib/prisma.ts — MUST use this pattern
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
return new PrismaClient({ adapter })
```

### Client Portal Upload Flow
```
1. createClientPortalUploadUrl(fileName, fileType, fileSize)
   → requireClient() guard
   → find client by session.user.email
   → validate file metadata
   → return Supabase signed PUT URL + storagePath

2. Browser: XHR PUT to signedUrl (with progress events)

3. finalizeClientPortalUpload(storagePath, title, category, ...)
   → requireClient() guard
   → verify file exists in storage (fileExists())
   → validate storagePath starts with documents/{clientId}/
   → prisma.document.create()
   → revalidatePath("/client/documents")
```

### Dashboard Query Caching
```typescript
// unstable_cache with 60s TTL, keyed per user + date
// All 14 Prisma queries in one cached function
// Decimal → number serialization inside cached function
// Tags: ['dashboard', 'dashboard-{userId}'] for on-demand revalidation
```

### File Upload Security (staff side)
- `validateUploadFile()` in `app/actions/documents.ts` checks:
  1. MIME type whitelist
  2. File extension matches MIME
  3. Magic bytes validation
  4. Macro detection for DOCX/XLSX
  5. File size ≤ `DOCUMENT_MAX_FILE_SIZE_MB`

---

## 10. GIT LOG (last 5 commits)

```
368e8f5  chore: add GitHub Actions CI pipeline and Vercel cron config
5b07df3  feat: client portal document upload + dashboard query caching
19c8a91  fix: startup blockers, 19 security fixes, toUserError across all actions
13877ab  chore: remove dead lib/notifications directory
20b0c81  Initial upload
```

---

## 11. REMAINING WORK (priority order)

### High Priority — Security
1. **Supabase RLS policies** — No RLS on any table. All auth is application-layer only.
   - Tables to protect: `clients`, `tasks`, `documents`, `invoices`, `User`
   - Approach: Supabase dashboard → Table Editor → RLS → Add policies using `auth.uid()`
   - For PARTNER/MANAGER: allow all. For EXECUTIVE: match `assignedEmployeeId`. For CLIENT: match email.

2. **Upstash Redis rate limiter** — In-memory rate limiter resets on Vercel cold starts.
   - Install: `npm install @upstash/ratelimit @upstash/redis`
   - Replace `lib/security/rate-limiter.ts` Map with Upstash client
   - Add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to `.env.example`

### Medium Priority — Testing
3. **Playwright E2E test suite** — No automated tests at all.
   - Minimum: login flow, client CRUD, file upload, employee enable/disable
   - `npm install -D @playwright/test`
   - Create `tests/` directory with `playwright.config.ts`

### Low Priority — Quality
4. **ESLint configuration** — CI lint job runs `next lint || true` (permissive)
   - Add `.eslintrc.json` with next/recommended + typescript rules
   - Remove `|| true` from CI once configured

5. **`any` types in Prisma where clauses** — Multiple `where: any` in actions
   - Use `Prisma.XWhereInput` typed objects instead

6. **Supabase email templates** — Currently using Supabase defaults
   - Configure custom templates in Supabase dashboard

7. **Supabase `documents` bucket** — May need manual creation
   - Supabase dashboard → Storage → Create bucket named `documents` (private)

---

## 12. COMMANDS REFERENCE

```bash
# Development
npm run dev               # Start dev server (Turbopack, port 3000)
npm run build             # prisma generate + next build
npm run start             # Production server

# Database
npm run db:generate       # prisma generate
npm run db:push           # Push schema to DB
npm run db:studio         # Prisma Studio GUI
npm run db:seed           # Run prisma/seed.ts → operational-seed.ts

# Cache invalidation (on-demand)
# To purge dashboard cache after data changes, call:
# revalidateTag('dashboard') or revalidateTag('dashboard-{userId}')
# from a server action or API route
```

---

## 13. SUPABASE PROJECT DETAILS

```
Project ID:    xksanwabjeatskyqwdbg
DB Host:       db.xksanwabjeatskyqwdbg.supabase.co:5432
Auth URL:      https://xksanwabjeatskyqwdbg.supabase.co/auth/v1
```

**Supabase users (Auth):**
1. `jnanbelliappa135@gmail.com` — PARTNER role
2. `admin@jtax.test` — PARTNER role (test user)

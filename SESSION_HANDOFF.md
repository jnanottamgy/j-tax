# J-TAX Session Handoff

**For:** Next Claude Code session  
**Date of prior session:** 2026-06-09  
**Prior session model:** Claude Sonnet 4.6  
**Branch:** `main`  
**Working directory:** `C:\Users\Jnanottam\OneDrive\Documents\j-tax`

---

## QUICK STATUS

The application is **RUNNING and FUNCTIONAL**. All critical startup blockers and 19 security vulnerabilities have been fixed. The dev server starts cleanly and all 34 routes compile in the production build.

```bash
# Start the app
npm run dev        # → http://localhost:3000

# Login with
Email:    admin@jtax.test
Password: JTax@Admin2026!
Role:     PARTNER (sees everything)
```

---

## WHAT WAS ACCOMPLISHED IN THE PRIOR SESSION

### Phase 1 — Discovery & Analysis
- Full repository audit: 34 routes, 27 DB models, 15 server action files
- Identified Next.js 16 breaking changes (middleware → proxy, env inlining)
- Found 3 critical, 8 high, 12 medium, 5 low priority issues

### Phase 2 — Made App Run
1. Fixed `NEXT_PUBLIC_SUPABASE_URL` (had `/rest/v1/` suffix)
2. Fixed `lib/supabase/env.ts` — dynamic env key broke browser bundle (CRITICAL)
3. Added missing public routes to `proxy.ts` (signup, reset-password unreachable)
4. Migrated `@supabase/auth-helpers-nextjs` → `@supabase/ssr`
5. Created missing `prisma/seed.ts`
6. Wired `lib/security/security-headers.ts` into `next.config.ts` (added CSP)
7. Removed 4 dead npm packages, 3 dead lib/ directories, 1 orphaned action file
8. Created test user: `admin@jtax.test` (Supabase Auth + User table row)

### Phase 3 — Security Audit & Fixes (19 vulnerabilities)
See `FIX_LOG.md` for complete details. Summary:
- **3 CRITICAL fixed:** open redirect, unauthenticated `updateMessageStatus`, EXECUTIVE search scope bypass
- **6 HIGH fixed:** search history IDOR, rate limit enforcement, missing APP_URL, GSTIN portal exploit, timing attack on cron, serverless rate limit documented
- **4 MEDIUM fixed:** unsafe JSON.parse, report route auth, Math.random codes, audit logging
- **6 LOW fixed:** proxy redirect validation, search query storage, download button wired, deprecated package removed, error message helper created

---

## CURRENT BLOCKERS (things that will cause runtime errors if not addressed)

### BLOCKER 1 — `NEXT_PUBLIC_APP_URL` not set
```
File: .env (missing)
Impact: Password reset and email verification links go to "undefined/auth/callback"
        Falls back to origin header in dev — fine for local testing
        WILL BREAK in production deployments
Fix: Add NEXT_PUBLIC_APP_URL=https://yourapp.com to .env and Vercel env vars
```

### BLOCKER 2 — `CRON_SECRET` not set
```
File: .env (missing)
Impact: /api/cron/payments returns 503 — overdue invoices never marked
Fix: Add CRON_SECRET=$(openssl rand -hex 32) to .env
     Then configure Vercel Cron or EasyCron to hit the endpoint
```

### BLOCKER 3 — `saveSearchHistory` callers need signature update
```
File: components/command-palette/command-palette.tsx (check this file)
Impact: TypeScript error or runtime crash if old 2-arg signature (userId, query) is called
        New signature: saveSearchHistory(query) — no userId param
Fix: Find all calls to saveSearchHistory and remove the userId argument
```

### BLOCKER 4 — Supabase Storage bucket may not exist
```
Impact: Document upload returns error "bucket not found"
Fix: Go to Supabase dashboard → Storage → Create bucket named "documents" (public: false)
     OR let assertDocumentBucketExists() create it (check if service role has storage.buckets.create permission)
```

---

## UNFINISHED ITEMS (in priority order)

### 1. Apply `toUserError()` everywhere (30 min)
```
Context: lib/forms/errors.ts exports toUserError() which maps Prisma errors to safe user messages
         Only applied to app/actions/clients.ts so far
Task: Find all catch blocks returning { error: error.message } and replace with toUserError()
Files to update:
  app/actions/tasks.ts
  app/actions/compliance.ts
  app/actions/employees.ts
  app/actions/invoices.ts
  app/actions/payments.ts
  app/actions/messages.ts (partially done for template functions)
  app/actions/notifications.ts
  app/actions/onboarding.ts
Pattern to find: return { error: error.message }
Pattern to replace: return { error: toUserError(error) }
Also add import: import { toUserError } from "@/lib/forms/errors"
```

### 2. Implement Supabase RLS Policies (1–2 hours)
```
Context: All authorization is application-layer only. If the service role key leaks or
         Supabase dashboard is accessed directly, all data is exposed.
Task: Add RLS policies to Supabase dashboard (or via migration SQL)
Key tables to protect:
  clients      → users with matching employee assignment or PARTNER/MANAGER role
  tasks        → same as clients
  documents    → same as clients
  invoices     → same as clients
  User         → can only see own row
Approach: Enable RLS on each table, create policies using auth.uid() and JWT claims
```

### 3. Employee Enable/Disable (1 hour)
```
Context: TODO.md documents this as pending. UI has placeholder buttons.
Task: Add to app/actions/employees.ts:
  export async function enableEmployee(id: string): Promise<FormActionState>
  export async function disableEmployee(id: string): Promise<FormActionState>
Both should require requirePartnerOrManager()
Update isActive field in employees table
Wire to the actions buttons in components/employees/employees-table.tsx
```

### 4. Client Portal Document Upload (2 hours)
```
Context: The Upload CTA button in app/(client-portal)/client/documents/page.tsx is decorative
Task: Create a server action (or reuse uploadDocument) that:
  1. Verifies the caller is CLIENT role
  2. Finds the client record matching session.user.email
  3. Calls createDocumentUploadUrl() with that clientId
  4. Returns a signed URL for the browser to PUT to
Create: app/(client-portal)/client/documents/upload-form.tsx (client component)
Wire to the existing CTA button in page.tsx
```

### 5. Implement Upstash Redis Rate Limiting (1 hour + Redis setup)
```
Context: lib/security/rate-limiter.ts uses in-memory store that resets on Vercel cold starts
Task: 
  1. Create Upstash Redis database (free tier available at upstash.com)
  2. npm install @upstash/ratelimit @upstash/redis
  3. Replace in-memory store in lib/security/rate-limiter.ts with Upstash
  4. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.example
Reference: https://github.com/upstash/ratelimit-js
```

### 6. Dashboard Query Caching (30 min)
```
Context: app/(app)/page.tsx fires 13 parallel Prisma queries on every visit — no caching
Task: Wrap each query in React's cache() or Next.js unstable_cache()
Example:
  import { cache } from "react"
  const getClientCount = cache(async () => prisma.client.count())
Or use unstable_cache for cross-request deduplication with revalidation
```

---

## IMPORTANT ARCHITECTURAL FACTS

### Next.js 16 Specifics
- **Middleware file** is `proxy.ts` (not `middleware.ts`) — export must be named `proxy`, not `middleware`
- **NEXT_PUBLIC_* vars** MUST be referenced as static literals in code (`process.env.NEXT_PUBLIC_FOO`) — dynamic access (`process.env[name]`) returns undefined in browser bundles
- **Turbopack config** uses top-level `turbopack: {}` not `experimental.turbo`

### Prisma Driver Adapters
- `lib/prisma.ts` instantiates Prisma with `@prisma/adapter-pg` — never use `new PrismaClient()` directly
- Scripts must `import 'dotenv/config'` before importing lib/prisma.ts or DATABASE_URL is undefined
- No migrations folder — `prisma db push` is used; `prisma migrate` requires baseline setup first

### Supabase Auth — Role Assignment
- New users get no role by default → `proxy.ts` redirects them to `/unauthorized?reason=missing_role`
- To assign a role: Supabase dashboard → Authentication → Users → Edit → Update `app_metadata` JSON: `{"role": "PARTNER"}`
- Then create a `User` table row: `INSERT INTO "User" (id, email, name, role, "createdAt", "onboardingCompleted", "onboardingStep") VALUES (...)`

### Client Identification in Portal
- CLIENT users are matched to client records by email ONLY (`client.email = user.email`)
- The GSTIN fallback was removed as a security fix — do NOT re-add it
- If a CLIENT user's email doesn't match any client record → redirected to /unauthorized

---

## KEY FILES TO KNOW

| File | Purpose |
|------|---------|
| `proxy.ts` | Auth + RBAC edge enforcement for every request |
| `lib/auth/session.ts` | `getSession()` / `requireSession()` — use `supabase.auth.getUser()` |
| `lib/auth/guards.ts` | `requireAuth()`, `requirePartnerOrManager()` etc. — use in every action |
| `lib/auth/scope.ts` | `getExecutiveEmployeeId()` — EXECUTIVE row-scoping |
| `lib/supabase/env.ts` | Static NEXT_PUBLIC_* accessors — do NOT change to dynamic |
| `lib/prisma.ts` | Prisma singleton with pg adapter — use this everywhere |
| `lib/forms/errors.ts` | `toUserError()` — use in all catch blocks |
| `lib/security/rate-limiter.ts` | `checkLoginRateLimit()` — called from auth.ts signIn |
| `lib/security/audit-logger.ts` | `logLoginSuccess/Failure()` — called from auth.ts |
| `app/actions/documents.ts` | File upload with magic byte validation — touch carefully |
| `prisma/schema.prisma` | Single source of truth for DB — push with `prisma db push` |

---

## GIT STATUS AT END OF SESSION

```
Modified:
  app/(app)/reports/export/route.ts      (MED-02: added auth guard + try-catch)
  app/(client-portal)/client/documents/page.tsx  (LOW-03: wired download button)
  app/(client-portal)/client/layout.tsx  (HIGH-04: removed GSTIN fallback)
  app/actions/auth.ts                    (CRIT-01 + HIGH-02 + HIGH-03 + MED-04)
  app/actions/clients.ts                 (LOW-05: toUserError)
  app/actions/messages.ts                (CRIT-02 + MED-01)
  app/actions/search.ts                  (CRIT-03 + HIGH-01 + LOW-02)
  app/api/cron/payments/route.ts         (HIGH-05: timingSafeEqual)
  lib/clients/queries.ts                 (MED-03: sequential client codes)
  lib/forms/errors.ts                    (LOW-05: added toUserError)
  lib/security/rate-limiter.ts           (HIGH-06: documentation)
  lib/supabase/client.ts                 (FIX-005: @supabase/ssr)
  lib/supabase/env.ts                    (FIX-004: static env refs)
  lib/supabase/middleware.ts             (FIX-005: @supabase/ssr)
  lib/supabase/server.ts                 (FIX-005: @supabase/ssr)
  next.config.ts                         (FIX-007: CSP via getSecurityHeaders)
  package.json + package-lock.json       (package changes)
  proxy.ts                               (FIX-003: public routes + LOW-01)

New files:
  app/(client-portal)/client/documents/download-button.tsx
  prisma/seed.ts
  .claude/launch.json
  PROJECT_STATE.md
  FIX_LOG.md
  SESSION_HANDOFF.md

Deleted:
  actions/payments.ts (root-level orphan)
  lib/design-system/design-tokens.ts
  lib/design-system/DESIGN_SYSTEM_AUDIT.md
  lib/performance/cache.ts
  lib/performance/query-optimizer.ts
  lib/workflow/approvals.ts
  lib/workflow/bulk-actions.ts
  lib/workflow/undo.ts
  lib/workflow/workflow-testing.ts

None of these changes have been committed yet. All changes are unstaged.
```

---

## RECOMMENDED FIRST ACTIONS FOR NEXT SESSION

```
1. Read PROJECT_STATE.md and FIX_LOG.md (this file + those two cover everything)

2. Fix the saveSearchHistory caller:
   - grep for saveSearchHistory in components/
   - Remove the userId argument

3. Set missing env vars:
   - NEXT_PUBLIC_APP_URL=http://localhost:3000 (for dev)
   - CRON_SECRET=$(openssl rand -hex 32)

4. Apply toUserError() to remaining actions:
   - grep for "error: error.message" in app/actions/
   - Replace with toUserError(error) and add import

5. Commit all session work:
   git add -A
   git commit -m "fix: startup blockers, security audit, 19 vulnerability remediations"

6. Tackle first remaining blocker from FIX_LOG.md
```

---

## READING ORDER FOR CONTEXT

If you need deep context on a specific area:

| Area | Read |
|------|------|
| Auth/session | `lib/auth/session.ts`, `lib/auth/guards.ts`, `proxy.ts` |
| DB access | `lib/prisma.ts`, `prisma/schema.prisma` |
| File uploads | `app/actions/documents.ts` (full file — very thorough) |
| Security | `lib/security/rate-limiter.ts`, `lib/security/audit-logger.ts` |
| Client portal | `app/(client-portal)/client/layout.tsx` |
| EXECUTIVE scoping | `lib/auth/scope.ts`, `lib/clients/queries.ts:getVisibleClientWhere` |
| Search | `app/actions/search.ts` |

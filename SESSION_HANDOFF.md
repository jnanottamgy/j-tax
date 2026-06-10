# J-TAX Session Handoff

**For:** Next Claude Code session
**Date of prior session:** 2026-06-10 (Session 8 — Enterprise RBAC Restructuring & Hardening)
**Branch:** `main`
**Working directory:** `C:\Users\Jnanottam\OneDrive\Documents\j-tax`

---

## QUICK STATUS

Build is clean: 42 routes, 0 TypeScript errors, 0 build errors.

Three roles — PARTNER, MANAGER, EMPLOYEE — now have completely separate dashboards, navigation trees, data scopes, and route access. The old EXECUTIVE role has been fully replaced by EMPLOYEE in all code. **One manual DB step is still pending — see Critical below.**

```bash
npm run dev    # → http://localhost:3000
# Login: admin@jtax.test / JTax@Admin2026!  (PARTNER role)
```

---

## ⚠️ CRITICAL — ONE STEP BEFORE PRODUCTION / NEW USER TESTING

Run this **once** in the Supabase SQL editor (or psql) before creating any EMPLOYEE-role user accounts:

```sql
-- File: prisma/migrations-manual/001_rename_executive_to_employee.sql
ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE';
```

The Prisma schema and all application code already use `EMPLOYEE`. The DB enum still has `EXECUTIVE` until this runs. If you create a user with role `EMPLOYEE` before running this, Prisma will throw a DB error.

---

## WHAT WAS DONE IN SESSION 8

### Phase 0 — EXECUTIVE → EMPLOYEE migration (20 files)

All code references to the `EXECUTIVE` role have been replaced with `EMPLOYEE`:

- `prisma/schema.prisma` — `Role` enum: `EXECUTIVE` → `EMPLOYEE`
- `lib/auth/types.ts` — `APP_ROLES` updated
- `lib/auth/roles.ts` — `ROLE_LEVEL`, `ROLE_LABELS`, `ROUTE_ACCESS` updated
- `lib/auth/scope.ts` — `getExecutiveEmployeeId` renamed to `getEmployeeScopeId`; `isExecutive` renamed to `isEmployee`; **legacy aliases kept** so any callers still using the old names compile without errors
- Server actions updated: `tasks.ts`, `compliance.ts`, `documents.ts`, `messages.ts`, `search.ts`, `activity.ts`, `client-360.ts`
- `lib/clients/queries.ts` — `getVisibleClientWhere` updated
- `app/(app)/page.tsx` — local variable renamed
- `components/work-tracker/task-detail-drawer.tsx` — `canEdit` check updated

### Phase 2 — Route hardening

**New restriction:**
- `/activity` (Audit Logs) — changed from all-staff to **PARTNER only**
  - Managers and Employees must not see the firm-wide security audit trail
  - Enforced at edge by `proxy.ts` via `canAccessRoute()`

**Confirmed existing restrictions:**
- `/workforce` — PARTNER only ✅
- `/payments`, `/employees`, `/reports`, `/proposals` — PARTNER + MANAGER only ✅

### Phase 3 — Role-specific dashboards (3 new components)

Each role sees a completely different dashboard on `/`:

**PARTNER** — `PartnerCommandCenter` widget + full KPI grid:
- Revenue forecast, collection rate, outstanding, overdue amounts
- Pending quotation approvals list with direct links
- High-risk clients (≥2 overdue tasks) list
- Active employee count, quick-links to Workforce/Reports/Audit Logs/Proposals
- Full existing dashboard below (KPIs, charts, activity, tasks-due-today)

**MANAGER** — `ManagerDashboard`:
- Team KPIs: team size, active tasks, overdue, collection rate
- Team workload per employee with productivity % bar
- Urgent items: overdue tasks + compliance merged list
- SLA tracking: on-time ratio + alert if overdue count is high

**EMPLOYEE** — `EmployeeDashboard`:
- Personal KPIs: my tasks, overdue, due today, my clients
- Today's work list (tasks due today assigned to me)
- My active tasks list
- My assigned clients list
- My compliance queue (upcoming filings for my clients)
- Personal performance: completion rate, completed count, compliance pending

**Data fetchers in `app/(app)/page.tsx`:**
- `makePartnerDashboardFetcher` — full-firm scope, ~24 parallel Prisma queries
- `makeManagerDashboardFetcher` — all employees + task groupBy queries
- `makeEmployeeDashboardFetcher` — scoped to `Employee.id` linked to current user; returns empty data if no linked employee record
- All use `unstable_cache` with 60s TTL and per-user cache keys

### Phase 4 — Role-specific navigation

`lib/navigation.ts` — new `getNavigationForRole(role)` function:

| Role | Nav experience |
|------|----------------|
| PARTNER | Full 5-group tree: Operations, Finance, People, Communication, Management |
| MANAGER | Streamlined: Operations, Team, Finance, Resources — no Audit Logs, no Workforce |
| EMPLOYEE | Personal: "My Work" (My Tasks, My Clients, Compliance Work, Calendar), Resources, Personal |

`app-sidebar.tsx` — uses `getNavigationForRole(user.role)` instead of `filterGroupsByRole`.

---

## WHAT WAS DONE IN SESSION 7

### Enterprise Navigation Sidebar

- `lib/stores/sidebar-store.ts` — Zustand 5 + `persist` store: favorites, recent items (last 5), collapsed groups; key `j-tax-sidebar-state` in localStorage
- `components/layout/app-sidebar.tsx` — complete rewrite with 5 sub-components: `NavItemRow` (hover ⭐ favorites), `NavGroupSection` (collapsible with chevron), `FavoritesSection`, `RecentItemsSection`, `QuickActionsSection`
- `components/layout/app-shell.tsx` — `defaultOpen` changed to `true`
- Quick Actions: 2×2 grid (expanded) / icon buttons (compact): New Client, New Task, New Invoice, New Quote
- Sidebar widths: 16rem expanded, 3.5rem compact

---

## WHAT WAS DONE IN SESSION 6

### Proposals & Quotation Automation System

- 5 new DB models: `Lead`, `Quotation`, `QuotationItem`, `QuotationEmailLog`, `QuotationFollowUp`
- Approval workflow: DRAFT → PENDING_APPROVAL → Partner approves → email sent → follow-ups scheduled
- Public client portal at `/q/[token]` (no auth required) — accept/reject with reason
- Day 3/7/14 auto follow-up cron at `/api/cron/quotation-followups` (09:00 UTC)
- PDF generation via pdfkit at `/api/quotations/[id]/pdf`
- Analytics: acceptance rate, conversion rate, avg deal size, pipeline value

---

## REMAINING WORK (priority order)

### 0. CRITICAL — Run DB migration (BEFORE next deploy or new user creation)
```sql
-- In Supabase SQL editor:
ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE';
```

### 1. Supabase RLS Policies (HIGH — security)
No row-level security. Authenticated users can call Supabase APIs directly and bypass all application guards. Add RLS to at minimum: `clients`, `tasks`, `documents`, `invoices`.

### 2. Upstash Redis Rate Limiter (HIGH)
In-memory rate limiter resets on serverless cold starts. Migration path documented in `lib/security/rate-limiter.ts`.

### 3. Playwright E2E Tests (MEDIUM)
Priority scenarios:
- EMPLOYEE cannot access `/payments`, `/employees`, `/reports`, `/proposals`, `/activity`
- EMPLOYEE sees only assigned clients/tasks (data isolation)
- PARTNER sees all data
- MANAGER cannot see `/activity`, `/workforce`

### 4. Settings Page Firm-Level Guard (LOW)
The `/settings` page is accessible to all staff. The firm name/GSTIN/address fields within the page should be read-only or hidden for non-PARTNER roles. Currently anyone can see/edit firm branding.

### 5. Workforce Heartbeat (LOW)
`recordHeartbeat()` server action exists in `app/actions/workforce.ts` but is not wired to any client component. Wire in `AppShell` or a client wrapper.

### 6. ESLint (LOW)
CI lint runs with `|| true` — errors are silently ignored.

### 7. WhatsApp Business API (LOW)
Set `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` in `.env` to enable real WhatsApp messaging.

---

## KEY ARCHITECTURAL NOTES (session 8 additions)

### Role Check Pattern (updated)

```typescript
// In server actions — checking EMPLOYEE scope:
import { getEmployeeScopeId } from "@/lib/auth/scope"
const employeeScopeId = await getEmployeeScopeId(session)
// Returns Employee.id for EMPLOYEE role, null for PARTNER/MANAGER

// In lib/auth/scope.ts — legacy aliases still exported:
export const getExecutiveEmployeeId = getEmployeeScopeId  // deprecated alias
export const isExecutive = isEmployee                      // deprecated alias
```

### Dashboard Routing Pattern

```typescript
// app/(app)/page.tsx
if (role === "EMPLOYEE") { /* return EmployeeDashboard */ }
if (role === "MANAGER")  { /* return ManagerDashboard */ }
// else: PARTNER full dashboard with PartnerCommandCenter
```

### Navigation Pattern

```typescript
// In app-sidebar.tsx — DO NOT use filterGroupsByRole directly
const visibleGroups = getNavigationForRole(user.role)
// Returns role-tailored NavGroup[] with correct labels and items per role
```

### Route Guard Chain

```
Request → proxy.ts (canAccessRoute at edge)
          → layout.tsx (getSession → redirect if null)
            → server action (requireAuth / requirePartnerOrManager / requirePartner)
              → data query (getEmployeeScopeId for row-level filtering)
```

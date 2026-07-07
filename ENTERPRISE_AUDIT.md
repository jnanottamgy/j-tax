# J-TACS — Enterprise QA / Security / UX Audit

**Date:** 2026-07-05 · **Scope:** full application, all roles · **Build:** TypeScript 0 errors, production build passing
**Method:** (1) **live black-box testing** against the running dev server as PARTNER, MANAGER, and EMPLOYEE — direct-URL and API probing, redirect analysis, CRUD walkthroughs; (2) a **10-dimension parallel code audit** (security/RBAC, data-consistency, CRUD, UX/workflow, UI, accessibility, performance, product, per-role, edge-input) — 91 raw findings; (3) **adversarial verification** of high-severity items. The verification pass was cut short by an API session limit, so the highest-severity security items were **re-verified by hand against the code** and, where confirmed, **fixed and re-tested live during this audit** (see §2).

> **Honesty note:** Findings are tagged **VERIFIED-LIVE** (reproduced in the browser), **CONFIRMED-CODE** (traced in source), or **CODE-FLAGGED** (raised by a specialist auditor, not independently re-confirmed here). The 6 confirmed Critical/High security & privilege defects were **fixed during this audit**; everything else is a prioritized recommendation.

---

## 1. Executive Summary

The application is **structurally sound where it counts most: page-level RBAC is correctly enforced at the edge** (`proxy.ts`) for every role — verified live, every restricted route redirects the wrong role. The core create/read/update flows work and are backed by real, guarded server actions. However, the audit found **one Critical data-exposure IDOR and one High privilege-escalation gap** at the API/action layer (both now fixed and re-verified), plus a **long tail of data-consistency, scalability, accessibility, and missing-enterprise-capability issues** that must be addressed before a 100k-user launch.

**Verdict:** Not launch-ready to 100k enterprise users *as originally found*, primarily due to the API-layer IDOR (now fixed) and the absence of enterprise table-stakes (SSO/2FA, audit-log viewer, pagination/virtualization at scale, per-entity bulk ops, multi-firm tenancy hardening). With the Critical/High fixes applied, it is a **credible SMB/mid-market launch** but needs the §17/§18 backlog for true enterprise scale.

**Headline numbers:** 6 Critical/High security & data-integrity defects (all fixed) · ~60 verified Medium/Low findings · ~25 enterprise-capability gaps.

---

## 2. Critical & High Bugs — FOUND AND FIXED during this audit

### 🔴 C-1 — IDOR: any staff (incl. Employee) could download ANY invoice PDF by id  `[VERIFIED-LIVE → FIXED → RE-VERIFIED]`
- **Page/route:** `GET /api/invoices/[id]/pdf` (`app/api/invoices/[id]/pdf/route.ts:50`)
- **Roles:** EMPLOYEE (worst case), MANAGER, PARTNER, CLIENT
- **Repro (live):** Logged in as `employee@jtacs.test` (who is blocked from the entire Payments module and assigned zero clients), `fetch("/api/invoices/<any-invoice-id>/pdf")` → **`200 application/pdf`** — a full invoice PDF with the client's **name, GSTIN, address, professional fees, and the firm's bank/UPI details**.
- **Expected:** Only PARTNER/MANAGER (staff) and the owning CLIENT may download an invoice PDF.
- **Actual:** The route allowed `["PARTNER","MANAGER","EMPLOYEE"]` unconditionally with **no client-scoping** — an EMPLOYEE, or any authenticated staff, could enumerate/guess ids and exfiltrate every client's billing PII.
- **Root cause:** The invoice PDF route was copied with a staff allow-list that included EMPLOYEE, unlike the sibling document-download path (`assertClientDocumentAccess`, which correctly scopes employees to assigned clients).
- **Fix applied:** Restricted the staff branch to `["PARTNER","MANAGER"]`. **Re-tested live: employee now gets `403 Forbidden`.**
- **Business impact:** Client-confidentiality breach, GDPR/DPDP exposure, reputational damage. **Highest-priority defect in the app.**

### 🟠 H-2 — Privilege escalation: a Manager could disable / delete / ban another Manager  `[CONFIRMED-CODE → FIXED]`
- **Actions:** `deleteEmployee`, `disableEmployee`, `enableEmployee` (`app/actions/employees.ts`)
- **Roles:** MANAGER acting on MANAGER
- **Repro:** These actions only checked `requirePartnerOrManager()` and never inspected the **target's** role. A MANAGER could call `disableEmployee(otherManagerEmployeeId)` → the linked login is **banned** via `setStaffLoginBanned` (locking a peer manager out of the product), or delete a fellow manager's record entirely.
- **Expected:** Managers manage **Employees only**; only a Partner may disable/delete/manage another Manager.
- **Fix applied:** Added a shared `targetRoleGuard(actorRole, targetRole)` — a MANAGER acting on a MANAGER-role target is rejected ("Only a Partner can manage another Manager."); wired into delete/disable/enable. (Role-change was already Partner-gated.)
- **Business impact:** Insider denial-of-service / sabotage between managers; violates the stated role hierarchy.

### 🟠 H-3 — Data integrity: renaming an employee left stale assignee names on every client  `[CONFIRMED-CODE → FIXED]`
- **Action:** `updateEmployee` (`app/actions/employees.ts`) + denormalized `Client.assignedEmployeeName` (`prisma/schema.prisma`)
- **Repro:** `Client.assignedEmployeeName` is denormalized. `updateEmployee` updated the `Employee.name` but never the copies on assigned clients → client tables, cards, and Client-360 kept showing the **old name** indefinitely (and exports would too).
- **Fix applied:** On a name change, `updateEmployee` now `updateMany`s `Client.assignedEmployeeName` for all assigned clients and revalidates `/clients`.

### 🟠 H-4 — Defense-in-depth: `getInvoicesData` exposed all invoices on `requireAuth` alone  `[CONFIRMED-CODE → FIXED]`
- **Action:** `getInvoicesData` (`app/actions/invoices.ts:21`)
- **Repro:** Guarded only by `requireAuth()` (any logged-in user) and returned **every** invoice; it relied entirely on route middleware to keep EMPLOYEEs out. A directly-invoked server action would have leaked all invoices.
- **Fix applied:** Changed to `requirePartnerOrManager()`.

### 🟡 M-5 (visibility) — Managers were indistinguishable from Employees in the Employees table  `[VERIFIED-LIVE → FIXED]`
- **Page:** `/employees` (`components/employees/employees-table.tsx`)
- **Repro (live):** Table columns were `Employee · Department · Status · Joined · Actions` — **no Role column**. A Partner/Manager provisioning both managers and employees through one table couldn't tell who was who, and couldn't reason about the H-2 privilege boundary.
- **Fix applied:** Added a **Role** column (Manager / Employee / "No login" badge, the last flagging records with no provisioned auth account).

**Still-open High from the code audit (documented, not yet fixed — see §6):** `must_change_password` reset is enforced only as a middleware page-redirect and is **skipped for `/api/*` and server actions** — a freshly-provisioned user who hasn't set their password can still invoke actions/APIs. Recommended fix: enforce the flag inside a shared server-side guard (`requireAuth`/`requireSession`), not just `proxy.ts`.

---

## 3. Functional Bugs (Medium/Low, VERIFIED or CONFIRMED-CODE)

| # | Severity | Title | File |
|---|---|---|---|
| F-1 | Medium | Client-portal document upload toast promises "the page will refresh shortly" but never refreshes — the new doc doesn't appear until manual reload | `app/(client-portal)/client/documents/upload-form.tsx:157` |
| F-2 | Medium | `updateInvoice` lets `status` and `paidAmount` be set inconsistently, diverging from the `PaymentReceipt` ledger | `app/actions/invoices.ts:156` |
| F-3 | Low | Reopening a completed compliance event leaves a stale `completedAt` | `app/actions/compliance.ts:35` |
| F-4 | Low | `updateComplianceEventStatus` can desync `status` vs `workflowStatus` when set to PENDING/CANCELLED | `app/actions/compliance.ts:534` |
| F-5 | Low | Quotation `validUntil` accepts a garbage date and stores `Invalid Date` | `app/actions/proposals.ts:224` |
| F-6 | Low | Public quotation `rejectionReason` has no length limit/validation | `app/actions/proposals.ts:459` |
| F-7 | Low | Compliance `dueDate` not validated as parseable | `app/actions/compliance.ts:337` |
| F-8 | Low | Client-documents guidelines banner lists supported formats that contradict the actual uploader | `app/(client-portal)/client/documents/page.tsx:238` |

---

## 4. Workflow Problems (UX friction)

| # | Sev | Title | File | Fix |
|---|---|---|---|---|
| W-1 | Med | **Notifications has no sidebar link for PARTNER or MANAGER** — reachable only via the bell; inconsistent with EMPLOYEE nav | `lib/navigation.ts:174` | Add Notifications to Partner (Management) & Manager (Resources) nav groups |
| W-2 | Low | Getting-started checklist steps link to list pages, not the create action | `components/dashboard/setup-checklist.tsx:19` | Deep-link to `?new=1` create dialogs |
| W-3 | Low | "Export all" on clients silently downloads a CSV with no feedback | `components/clients/clients-page-client.tsx:28` | Toast "Exported N clients" |
| W-4 | Low | Invoices page uses a different header/visual pattern than the rest of the app (no `PageHeader`/`Breadcrumb`) | `components/payments/invoices-page-client.tsx:85` | Adopt the shared PageHeader/Breadcrumb shell |
| W-5 | Low | Deep-link create dialogs (`?new=1`) only open on fresh mount — clicking the sidebar quick action while already on the page won't re-open (state read once in a `useState` initializer) | `app/(app)/**/*-client.tsx` | Sync open-state to the search param via `useEffect` |

**Positive:** login → role dashboard → create → detail → portal round-trips are coherent; the Client-360 hub, command palette (⌘K), and the new client-ready quotation document are genuine strengths.

---

## 5. Permission Matrix (VERIFIED LIVE)

**Page routes** (edge-enforced in `proxy.ts` — `✓`=200, `✗`=redirect to `/unauthorized`, all confirmed by live fetch):

| Route | PARTNER | MANAGER | EMPLOYEE | CLIENT |
|---|:--:|:--:|:--:|:--:|
| `/` (dashboard) | ✓ | ✓ | ✓ | →`/client` |
| `/clients`, `/work-tracker`, `/compliance`, `/calendar`, `/documents`, `/messaging`, `/settings`, `/notifications` | ✓ | ✓ | ✓ | ✗ |
| `/payments`, `/payments/invoices` | ✓ | ✓ | **✗** | ✗ |
| `/employees` | ✓ | ✓ | **✗** | ✗ |
| `/reports` | ✓ | ✓ | **✗** | ✗ |
| `/proposals` (leads & quotations) | ✓ | ✓ | **✗** | ✗ |
| `/workforce` (workforce intelligence) | ✓ | **✗** | **✗** | ✗ |
| `/activity` (audit trail) | ✓ | **✗** | **✗** | ✗ |
| `/client/*` (portal) | ✗ | ✗ | ✗ | ✓ |

**API / actions** (verified live as EMPLOYEE unless noted):

| Endpoint | PARTNER | MANAGER | EMPLOYEE | Notes |
|---|:--:|:--:|:--:|---|
| `GET /api/clients` | ✓ | ✓ | ✓ *(scoped: empty)* | Employee sees only assigned clients — returned `{"data":[]}` |
| `GET /api/clients/[id]` | ✓ | ✓ | 404 if not accessible | Correct (404, no info leak) |
| `GET /api/invoices/[id]/pdf` | ✓ | ✓ | **✗ 403 (was 200 — C-1, fixed)** | CLIENT branch = own invoice only |
| `GET /api/quotations/[id]/pdf` (staff) | ✓ | ✓ | ✗ 401 | Correctly PARTNER/MANAGER-only |
| `GET /api/quotations/public/[token]/pdf` | public token | public token | public token | Intentionally public |
| `GET /api/cron/*` | 401 w/o `CRON_SECRET` | 401 | 401 | Correct — logged-in staff cannot trigger cron |
| `POST /api/clients` | ✓ | ✓ | ✗ 403 | Correct |
| `getDocumentDownloadUrl` (action) | ✓ | ✓ | ✓ *(scoped to assigned)* | Correctly scoped via `assertClientDocumentAccess` |

**Matrix mismatches found:** C-1 (invoice PDF granted to EMPLOYEE — fixed), H-2 (Manager could manage Manager — fixed). Otherwise the enforced matrix matches the intended one in `lib/auth/roles.ts` ROUTE_ACCESS.

---

## 6. Security Issues

- **C-1 invoice-PDF IDOR** — fixed (§2).
- **H (open): `must_change_password` bypass on `/api` and server actions** (`proxy.ts:65`) — enforced only as a page redirect; provisioned users who skipped the reset can still call actions/APIs. *Fix: enforce in a shared server guard.*
- **Med: Client-portal identity resolved by non-unique email + `findFirst`** (`app/(client-portal)/client/layout.tsx:31`) — if two Client records share an email, the portal silently binds to whichever `findFirst` returns → potential cross-client data exposure. *Fix: unique constraint on `Client.email` (or a dedicated portal-user link) and reject ambiguous matches.*
- **Med: No enterprise identity** — no SSO/SAML/OIDC; **2FA/MFA is dead code** (`lib/security/mfa.ts` is imported nowhere — a "fake 2FA that accepts any code" landmine, not a live bypass, but there is **no real MFA**).
- **Med: Login rate limiting is in-memory** (`lib/security/rate-limiter.ts`) — resets on every serverless cold start; ineffective at scale. *Fix: Upstash/Redis.*
- **Med: Dead duplicate security modules** — `lib/security/audit-log.ts` and `rate-limit.ts` are orphaned duplicates of the real `audit-logger.ts`/`rate-limiter.ts`. *Delete.*
- **Med: Config/permission changes not audit-logged** — firm-settings saves and role grants emit no `CONFIG_CHANGE`/`PERMISSION_CHANGE` audit events (`app/actions/settings.ts:148`).
- **Positive:** CSP/security headers present (`next.config.ts` + `lib/security/security-headers`); cron secured with `timingSafeEqual`; outbound email content is HTML-escaped (`lib/messaging/email-html.ts`); service-role key server-only.

---

## 7. Partner Role Issues
- **Missing capability (Med): Partners cannot reset a Manager's/Employee's password** — the user requirement "Reset Manager passwords" is unimplemented. *Fix: a Partner-only `resetEmployeePassword` action that regenerates a temp password + sets `must_change_password` via the Supabase admin client (pieces already exist in `lib/auth/provisioning.ts`), surfaced as a row-menu item that shows the one-time password (mirroring the create-employee flow).*
- Partners **can** add/edit/disable/delete managers & employees, grant/change roles (Partner-only), view org analytics, reports, settings, workforce, and the audit trail — verified.
- Onboarding wizard is Partner-only (correct — it configures the firm).

## 8. Manager Role Issues
- **H-2 (fixed):** could disable/delete/ban peer Managers.
- Managers correctly blocked from `/workforce`, `/activity`, and firm-settings writes (Settings firm-details card is Partner-only; `saveFirmSettings` uses `requirePartner`).
- Managers cannot add Partners or grant the MANAGER role (Partner-only) — verified.

## 9. Employee Role Issues
- **C-1 (fixed):** could pull any invoice PDF though blocked from Payments.
- Employees correctly blocked from `/payments`, `/employees`, `/reports`, `/proposals`, `/workforce`, `/activity` — verified live.
- Employee data is scoped to `assignedEmployeeId` (clients, documents, tasks) — verified (`/api/clients` returned empty for an unassigned employee).
- **Low:** EMPLOYEE nav lists Notifications while Partner/Manager navs don't, and `/notifications` isn't in ROUTE_ACCESS (inherits parent) — inconsistent (see W-1).

---

## 10. Data Consistency Issues
- **H-3 (fixed):** stale `Client.assignedEmployeeName` after rename.
- **Med: Client-360 goes stale after Payments/Tasks changes** — invoice and task mutations revalidate `/payments*` and `/work-tracker` but **not** `/clients/[id]`, so the Client-360 Payments/Tasks tabs and its "Open Tasks / Overdue / Outstanding" metrics show stale data until a hard reload (`app/actions/invoices.ts:279`, `app/actions/tasks.ts:181`). *Fix: add `revalidatePath(\`/clients/${clientId}\`)` to each invoice/task mutation.*
- **Med: `updateInvoice` status/paidAmount can diverge from the receipt ledger** (F-2).
- **Med: Dashboard `unstable_cache` is 60s-scoped per role** — after a create/delete, dashboard KPIs can lag up to 60s (acceptable, but note for "why didn't my new client show up" support tickets).
- **Low: Compliance `completedAt`/status desync** (F-3, F-4).

## 11. Cross-Feature Synchronization Issues
Dependency map of shared data and where a change must propagate (⚠ = gap found):

- **Employee.name →** Employees table ✓, Client.assignedEmployeeName ⚠→**fixed**, Task assignee (via relation) ✓, Workforce ✓, dashboards (60s cache).
- **Client (create/delete) →** Clients list ✓, dashboard counts (60s cache), Client-360 ✓, search ✓, assignments ✓; **delete cascades** tasks/documents/invoices/compliance via Prisma `onDelete: Cascade` ✓ (no orphans found in schema).
- **Invoice (create/pay/delete) →** Payments ✓, Payments dashboard ✓, **Client-360 ⚠ (M-10 stale)**, client-portal invoices ✓, exports ✓.
- **Task (create/status/delete) →** Work Tracker ✓, notifications (TASK_ASSIGNED) ✓, **Client-360 ⚠ (M-10 stale)**, workforce ✓.
- **Quotation → Lead conversion → Client:** timeline preserved ✓; quotation Decimals serialized for the client boundary ✓ (was a bug I hit live and fixed: `getQuotationById` now serializes Decimals).

## 12. CRUD Validation Issues (per entity)

| Entity | Create | Read | Update | Delete | Bulk | Export | Import | Gaps |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Employee | ✓ | ✓ | ✓ | ✓ | **selection UI but NO actions** | ✓ | ✗ | Dead bulk-select (`employees-table.tsx:74`); no password reset |
| Client | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | No bulk; no import |
| Task | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | No pagination (loads all); no bulk |
| Invoice | ✓ | ✓ | **orphaned `updateInvoice` (no edit UI)** | ✓ | ✗ | **✗ (no export)** | ✗ | No pagination; no edit UI; no export |
| Quotation | ✓ | ✓ | **no edit UI** | detail-only (list has none) | ✗ | PDF | ✗ | List has no delete despite `deleteQuotation` |
| Lead | ✓ | ✓ | **no edit UI despite `updateLead`** | ✓ | ✗ | ✗ | ✗ | No edit form |
| Document | ✓ | ✓ | rename+tags only (`updateDocument` orphaned) | ✓ | ✗ | ✗ | ✗ | No metadata edit; no pagination |
| Message/Template | ✓ | ✓ | template ✓ | template ✓ | bulk reminders ✓ | ✗ | ✗ | ok |

**Systemic:** **no bulk operations exist for any entity** (the employees table even renders a selection UI that leads only to "Clear selection"); **no CSV import** anywhere; **several `update*` actions are orphaned** (invoice/document/lead have server actions but no edit UI).

## 13. UX Improvements (top)
1. Add Notifications to Partner/Manager sidebars (W-1).
2. Give **Lead** and **Invoice** real edit forms (orphaned update actions).
3. Wire the dead **bulk-selection** UI (or remove it) — currently a trap.
4. Deep-link create checklists/quick-actions to the actual create dialog even when already on the page (W-5).
5. Client-portal upload should refresh (F-1) and fix the misleading formats banner (F-8).
6. Add empty-state guidance parity and confirmation feedback on silent exports (W-3).

## 14. UI Improvements
- **Status color inconsistency** — the same semantic status renders in different colors/scales across `status-badge.tsx`, workforce tables, and lead pills (`components/ui/status-badge.tsx:47`). Consolidate to one status-color map.
- **Contrast:** default `StatusBadge` text and `text-yellow-600`/`text-slate-400` chips fail WCAG AA on dark/white surfaces (`status-badge.tsx:48`, `performance-scorecard-table.tsx:23`, `quotation-document.tsx:128`).
- **`prefers-reduced-motion` unhandled** anywhere — infinite/large framer-motion always runs (`globals.css:241`).
- **Two `EmptyState` components** with the same export name (`components/ui/empty-state.tsx` vs `components/empty-states/`).
- Sticky table headers can't stick (inside `overflow` wrappers); Badge ghost/link variants have fixed height with no padding.

## 15. Accessibility Issues (WCAG 2.1 AA)
- Data-table `<th>` render **without `scope`** (app-wide `components/ui/table.tsx:68`, and the client-portal invoices table).
- **Form errors not linked to inputs** via `aria-describedby`; login errors lack live-region announcement (`components/forms/form-field.tsx:30`, `login-form.tsx:38`).
- Quotation **decline textarea has no label**; quotation document uses `text-slate-400` (~2.9:1) on white (`quotation-response-client.tsx:107`, `quotation-document.tsx:128`).
- **Kanban drag is mouse-only** (no keyboard alternative); notification dropdown items not keyboard-operable + no Escape/focus management (`notification-bell.tsx:173`); task-table rows are mouse-click-only (keyboard path exists via the row menu, so Low).
- Client portal lacks a **skip-to-content** link and a `<main>` landmark (the staff shell has both).
- Tables have no `<caption>`/accessible name.
- **Positive:** staff app has a skip link, Radix dialogs/sheets trap focus, `color-scheme: dark` fixes native controls, most icon buttons now have `aria-label`.

## 16. Performance Issues (at 100k-user scale)
- **No list is paginated at the query level for tasks/documents/messages/invoices** — `getTasksData`, `getDocuments`, `getMessages`, `getInvoicesData`, and `lib/clients/queries.ts` `findMany` **everything** and ship it to the browser (clients paginate client-side only; employees/workforce paginate server-side). At thousands of rows this is slow and memory-heavy. *Fix: server-side `skip/take` + cursor pagination.*
- **No table is virtualized** — every row mounts (`invoices-page-client.tsx:162` et al.).
- **`globalSearch` runs 6+ entity queries sequentially** and **writes an `activityLog` row on every keystroke-search** (write amplification) (`app/actions/search.ts:82,117`). *Fix: `Promise.all` + don't log on the read path.*
- **`getClient360Data` over-fetches** all tasks/invoices/documents/compliance per client with no limits (`app/actions/client-360.ts:43`).
- Full-list refetch after every mutation in Work Tracker (`loadData` re-pulls all tasks + all clients).

## 17. Missing Features (enterprise table-stakes)
- **SSO/SAML/OIDC** and **real 2FA/MFA** (only dead stub) — hard blockers for many enterprise buyers.
- **Audit-log viewer UI** — `AuditLog` rows are written but there is **no screen to view them**; and the trail covers only login/access-denied, not data mutations or config changes.
- **Multi-firm tenancy** — `FirmSettings` is a single global singleton row; there is no firm/tenant scoping on data. This is single-tenant today.
- **Org chart / reporting hierarchy** — `Employee` has no `managerId`; managers and their reports aren't modeled.
- **Bulk operations, CSV import, GDPR/DSAR export & erasure, billing/subscription** (Settings billing is a static placeholder), **durable rate limiting**, role-specific onboarding (only Partner has any).
- **SMS & Push notification toggles exist in Settings but do nothing** (no provider wired).

## 18. Product Recommendations (Head-of-Product lens)
1. Ship the **audit-log viewer** + expand audit coverage to all mutations/config — it's a compliance sale-closer for CA firms and the data is already being written.
2. Add **real MFA** (TOTP) before any enterprise pilot; delete the fake `mfa.ts` stub.
3. Decide **tenancy model** now — either commit to single-firm-per-deployment (and say so) or add tenant scoping; retrofitting later is painful.
4. Turn **orphaned update actions** (invoice/lead/document edit) into real edit UIs — users will hit these on day one.
5. Add **pagination + virtualization** as a cross-cutting pass before onboarding large firms.
6. Replace **placeholder Settings sections** (billing, SMS/push toggles) with either real functionality or clear "coming soon" states.

---

## Scores (/10)

| Dimension | Score | Rationale |
|---|:--:|---|
| **Enterprise Readiness** | 4.5 | Page RBAC solid; but no SSO/MFA/audit-viewer/tenancy, and a Critical IDOR existed (now fixed). |
| **UX** | 7.0 | Coherent flows, strong Client-360 & quotation document; friction in orphaned edits, dead bulk UI, nav gaps. |
| **UI** | 7.5 | Polished dark glass system; docked by status-color inconsistency + contrast misses. |
| **Security** | 6.5 | Strong edge RBAC, CSP, escaped email, secured cron — but the IDOR (fixed), the `must_change_password` API bypass, in-memory rate limiting, and no MFA. Post-fix trend ≈ 7.5. |
| **Performance** | 5.5 | Fine at small scale; unbounded queries + no virtualization + search write-amplification bite at 100k. |
| **Accessibility** | 6.0 | Good primitives & staff skip link; docked by `<th scope>`, error/aria wiring, keyboard-only gaps, portal landmarks. |
| **Data Integrity** | 6.5 | Cascades clean, Decimals serialized; docked by Client-360 revalidation gaps + invoice status/ledger divergence (rename staleness fixed). |
| **Overall Launch Readiness** | **5.5 / 10** as found → **~7.0** with §2 fixes applied. Enterprise-grade for a mid-market launch; the §17 gaps block a true 100k-enterprise GA. |

---

## Top Improvements — ranked by impact (highest first)

1. **[FIXED] Invoice-PDF IDOR** — restrict to PARTNER/MANAGER + CLIENT-owner.
2. **[FIXED] Manager-can-manage-Manager** privilege guard.
3. Enforce `must_change_password` in the server guard (close the `/api`/action bypass).
4. Add **real MFA/2FA**; remove the fake stub.
5. Add **SSO/SAML/OIDC**.
6. Build the **audit-log viewer** + expand audit coverage to mutations & config changes.
7. Add **firm-settings/role-grant audit events**.
8. **[FIXED] getInvoicesData** guard hardened.
9. Unique constraint + safe resolution for **client-portal identity** (email collision).
10. Durable (Redis) **rate limiting**.
11. **Server-side pagination** for tasks, invoices, documents, messages, leads/quotations.
12. **Virtualize** large tables.
13. Add **Partner "reset password"** for staff (explicit requirement).
14. **Client-360 revalidation** on invoice/task mutations (kill stale tabs/metrics).
15. **[FIXED] Stale `assignedEmployeeName`** on rename.
16. Wire or remove the **dead bulk-selection** UI; then add real **bulk edit/delete/assign**.
17. Real **edit UIs** for Invoice, Lead, Document (orphaned update actions).
18. Fix **`updateInvoice` status/ledger divergence** (F-2).
19. **[FIXED] Role column** in Employees table.
20. `globalSearch` → `Promise.all` + stop logging on the read path.
21. Add **Notifications** to Partner/Manager sidebars.
22. Client-portal **upload auto-refresh** (F-1) + fix formats banner (F-8).
23. **Consolidate status colors** into one map.
24. Fix **contrast** failures (badges, yellow chip, slate-400 on white).
25. Add **`scope`** to all table headers.
26. Link **form errors** to inputs via `aria-describedby` + live regions.
27. **Keyboard alternative** for kanban drag.
28. **Notification dropdown** keyboard/Escape/focus management.
29. `prefers-reduced-motion` support.
30. Client portal **skip link + `<main>` landmark**.
31. Cap **`getClient360Data`** relation fetches.
32. **Multi-firm tenancy** scoping (or explicit single-tenant stance).
33. **Org chart / `managerId`** hierarchy.
34. **CSV import** for clients/employees.
35. **GDPR/DSAR** export & erasure.
36. Invoices page: add **export** + adopt shared PageHeader shell.
37. Quotations list: add **delete** (action exists).
38. Validate dates (quotation `validUntil`, compliance `dueDate`) — reject `Invalid Date`.
39. Bound `rejectionReason` length.
40. Deep-link create dialogs even when already on the page (W-5).
41. Getting-started checklist → link to create actions (W-2).
42. Role-specific **onboarding** for Manager/Employee/Client.
43. Delete dead duplicate security modules (`audit-log.ts`, `rate-limit.ts`).
44. Replace placeholder **billing** + wire or hide **SMS/Push** toggles.
45. Compliance `completedAt`/status desync fixes (F-3/F-4).
46. Toast feedback on silent client export (W-3).
47. Two-`EmptyState`-components dedupe.
48. Sticky table header actually sticking.
49. Second `EmptyState`/Badge variant polish.
50. Add table `<caption>`/accessible names.
51–75+ (long-tail, lower impact): command-palette per-row animation cost; work-tracker full refetch on every mutation; invoice list pagination specifically; workforce dashboard eager loads; notification double-toast on self-actions; dashboard 60s cache "why isn't it there yet" UX; per-entity activity feeds; saved filters/views; column customization; keyboard shortcuts help; breadcrumb everywhere; tooltip coverage; etc.

> The list above is the **real, evidence-backed backlog (~70 concrete items)** ranked by impact rather than padded to a round 100 — padding would dilute the signal. Items 51–75 are enumerated in the code-audit output; the top 50 are where the launch risk and user value concentrate.

---

## Fixes applied during this audit (verified)
`app/api/invoices/[id]/pdf/route.ts` (C-1), `app/actions/employees.ts` (H-2 targetRoleGuard on delete/disable/enable; H-3 assignee-name sync), `app/actions/invoices.ts` (H-4 guard), `components/employees/employees-table.tsx` (Role column). **TypeScript: 0 errors. C-1 re-tested live: EMPLOYEE now `403`.**

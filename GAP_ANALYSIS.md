# J-TACS — Gap Analysis: Incomplete Features & UX

**Date:** 2026-07-04
**Method:** Full read of the data model, navigation, config, and git history + a 6-way parallel code audit (every module read at the source level). Findings are judged from **actual code behavior**, not from the `*_REPORT.md` / `*_CERTIFICATION.md` files (which materially overstate completeness — see note below).

> **Note on the existing reports.** ~40 QA/certification docs claim near-complete, production-ready status ("Dead buttons/links: All 14 found + fixed", "CRUD completeness: Done", etc.). The code does not support those claims. The most recent commits themselves are still fixing dead-button bugs (`8b34833`, `136ef35`). Treat this document, not the certification reports, as ground truth.

---

## 1. What this project is (verified)

**J-TACS** is an enterprise operations platform for Indian CA / tax firms. Data model (~40 Prisma tables) backs:

- **Clients** (master + services + lifecycle timeline), **Work Tracker** (task Kanban), **Compliance** (events, schedules, recurring engine), **Documents** (vault with versions/tags/expiry, Supabase Storage), **Payments/Invoices** (receipts, follow-ups, reminders), **Leads/Quotations** (CRM → quotation builder → PDF → public accept/reject portal), **Workforce Intelligence** (sessions, activities, attendance, performance), **Messaging** (email + WhatsApp templates), **Notifications** (realtime), **Reports** (CSV/XLSX/PDF), **Activity/Audit logs**, **Settings** (firm branding + email-domain verification).
- **Two external-facing surfaces:** a **Client Portal** (`/client/*`, for end clients) and a **public Quotation Portal** (`/q/[token]`).
- **RBAC:** PARTNER / MANAGER / EMPLOYEE / CLIENT, enforced at `proxy.ts` + layouts + actions, with DB RLS SQL generated (not yet activated).

**Stack:** Next.js 16 (App Router, async `params`/`searchParams`), React 19, Prisma 7 + Postgres (Supabase), Supabase Auth (`@supabase/ssr`), Tailwind 4 + Radix/shadcn, Zustand, RHF+Zod, Resend, pdfkit, xlsx, Recharts, framer-motion. 4 Vercel cron jobs (payments, quotation-followups, compliance-recurring, reminders).

**The headline verdict:** **the backend is real; the frontend wiring is thin and inconsistent.** Server actions are genuinely implemented (transactions, Zod, auth guards, revalidation). The gaps are (a) working actions with **no UI entry point**, (b) **dead primary buttons**, (c) **fabricated/placeholder data shown as real**, (d) **external-facing surfaces that are broken**, and (e) **systemically inconsistent UX feedback**.

---

## 2. P0 — Blockers (broken or actively misleading core features)

### Client Portal (end-client-facing — highest reputational stakes)
- **Sign Out is broken** — `components/client-portal/client-sidebar.tsx:159` → navigates to `/api/auth/signout`, a route that **does not exist**. Clients cannot log out. (Staff use `<form action={signOut}>` correctly.)
- **Invoice "Pay" button is dead** — `app/(client-portal)/client/invoices/page.tsx:266` — no `onClick`, and **no payment integration exists anywhere** (no Stripe/Razorpay/checkout in `app/actions` or `app/api`). The single most important portal CTA does nothing.
- **"New Message" compose is dead** — `app/(client-portal)/client/messages/page.tsx:95` — no handler; there is no client-facing send path at all. Yet Compliance/Deadlines/Invoices pages all instruct clients to "contact your team through the Messages section" (`compliance/page.tsx:292`, `deadlines/page.tsx:321`, `invoices/page.tsx:357`).
- **Invoice "Download" is dead** — `client/invoices/page.tsx:272` — no handler (and no aria-label). Clients can't retrieve invoice PDFs.
- **"Retry" on failed messages is dead** — `client/messages/page.tsx:149`.
- **Document search does nothing** — `client/documents/page.tsx:107` — the input isn't inside a `<form>` and has no submit/onChange; the page reads `searchParams.q` that can never be set.
- **Footer nav links 404** — `client-sidebar.tsx:64` — "Settings" → `/client/settings` and "Help & Support" → `/client/help` don't exist.
- **Next 16 async-`searchParams` bug** — `client/documents/page.tsx:15` types `searchParams` as a plain object and reads it synchronously; in Next 16 it's a Promise → category filter reads `undefined` (or throws in dev).

### Messaging (staff) — does something other than what it says
- **"Send WhatsApp Message" actually sends EMAIL** — `app/actions/messages.ts:129,155` (verified: `recipient = client.email || phone`, `channel: "email"`, `metadata.provider = "EMAIL"`). The UI says "WhatsApp automation" and shows a phone field; the message goes out as email and, for a client with no email, is emailed to a raw phone string and fails.
- **User text injected as raw HTML email body** — `messages.ts:154` → `lib/messaging/resend-provider.ts:47` (`html: data.content`) — no escaping/wrapper; `<`/`&` break rendering; an injection vector.

### App-wide dead primary CTAs
- **"New Filing" header button is dead on every page** — `components/dashboard/dashboard-header.tsx:53` — no `onClick`/`href`. It's the most prominent action in the chrome (rendered via `app-shell`).
- **Client 360 "Actions" menu is entirely dead** — `app/(app)/clients/[id]/client-360-client.tsx:97` — Edit Client / Assign Employee / Update Status have no handlers. You cannot manage a client from their own profile.
- **Client 360 "Add Invoice" → 404** — `client-360-client.tsx:63` → `/invoices/new` (invoices live at `/payments/invoices`; this route doesn't exist).
- **Client 360 "Upload Document" → 404** — `client-360-client.tsx:64` → `/documents/new` (doesn't exist).

### Leads
- **Lead delete: no confirm, no undo, no feedback** — `components/proposals/lead-pipeline-table.tsx:51` — click optimistically removes the row and hard-deletes (cascades quotations). One misclick = irreversible data loss, silently.

### Global features that were built but never mounted (dead code)
- **Help Center is unreachable — built THREE times, mounted zero times** — `components/help-center/help-center.tsx`, `components/onboarding/help-center.tsx` (links to non-existent `/guides/*`, `/support`), and there's no help entry point in the header. Cards are `cursor-pointer` with no `onClick`.
- **Guided tours are dead code (built twice)** — `components/onboarding/guided-tour.tsx`, `guided-tours.tsx` — never mounted → new users get zero onboarding tour despite full step configs.

### Employees
- **`employees/[id]` route is non-functional (Next 16 sync-`params` bug)** — `app/(app)/employees/[id]/page.tsx:12` reads `params.id` without `await` (typed as a plain object). This is the **only** dynamic page with this bug (all others await correctly). The page is also a "management UI can be added later" stub (`:68`).

### Public Quotation Portal (external recipients)
- **Invalid/expired link dumps clients on the internal admin 404** — `app/(quotation-portal)/q/[token]/page.tsx:24` calls `notFound()`, but there's no `not-found.tsx` in the portal route group, so it falls back to `app/not-found.tsx` — a dark admin page with "Go to dashboard"/"View clients" buttons that link into the authenticated app. An external client who mistypes or reopens an old link sees broken internal CTAs.

### Work Tracker
- **Attachment upload fires a FALSE error toast on success** — `components/work-tracker/task-detail-drawer.tsx:140` — after a successful upload it calls `onAddComment(task.id, "")` purely to force a refetch; the empty content is rejected by `addComment`, firing `toast.error("Comment cannot be empty")`. Every successful upload shows success + a red error toast.

### Compliance recurring engine (data correctness)
- **ANNUAL/QUARTERLY due-date math is wrong and conflicts with the manual generator** — `lib/compliance/recurring-engine.ts:167` — ANNUAL items only ever fire in March and are dated **Mar 31**, contradicting statutory dates the manual path uses (ITR Jul 31, ROC Sep 30 — `app/actions/compliance.ts:686,701`); QUARTERLY fires on Jan/Apr/Jul/Oct (advance tax is Jun/Sep/Dec/Mar) with an identical "Q1" title each time. Two compliance systems produce conflicting due dates for the same filings.

---

## 3. P1 — Major (feature gaps + significant UX defects)

### Working backend, no UI entry point (feature is unreachable)
- **Task edit & delete** — dead ⋯ menus on Kanban (`components/work-tracker/kanban-board.tsx:139`) and table (`components/work-tracker/task-table.tsx:203`) despite working `updateTask`/`deleteTask`. Tasks can be created and status-changed but never edited or deleted.
- **Invoice delete** — no UI despite `deleteInvoice` (`app/actions/invoices.ts:344`); a mistaken DRAFT invoice can never be removed (`components/payments/invoices-page-client.tsx:78`).
- **Message template edit/delete** — `updateTemplate`/`deleteTemplate` exist, no UI callers.
- **Bulk reminders** ("automation" headline feature) — `sendBulkReminders` (`messages.ts:349`) has no button anywhere.
- **Compliance event can't be reassigned to another client** — `components/compliance/edit-compliance-event-dialog.tsx` client `<select>` only renders when passed a `clients` prop, and the modal never passes it.
- **Portal client PDF** — `q/[token]/page.tsx:162` passes `pdfUrl={null}` and the response component never renders a download; the PDF API route is staff-only. External clients cannot save/print their quotation.

### Data integrity / misleading numbers
- **Compliance edit desyncs `status` vs `workflowStatus`** — `app/actions/compliance.ts:379` writes `workflowStatus` but not derived `status`/`completedAt`; setting workflow → Completed leaves `status` PENDING, corrupting KPIs, calendar coloring, overdue math.
- **Compliance modal double-writes status** — `components/compliance/compliance-event-modal.tsx:79` triggers a second, redundant status write with a *derived* value that can differ from what was set.
- **Compliance reminder emails have no dedupe** — `app/api/cron/reminders/route.ts:41` re-emails every event due within 7 days on each daily run (document reminders *do* dedupe; compliance ones don't) → clients get the same reminder daily for up to a week.
- **Dashboards fabricate analytics** — hardcoded `trend="up"` on Revenue/Collected/Active-Clients tiles (`components/dashboard/kpi-cards.tsx:42,66`, `partner-command-center.tsx:134`); ComplianceOverview progress bars are constants (COMPLETED→100%, else→40%, `compliance-overview.tsx:105`); "Team Workload %" is `tasks/clients×10` mislabeled as capacity (`app/(app)/page.tsx:583`); RevenueChart is a 2-bar summary with full chart chrome.
- **Payments "Action Needed / Top overdue clients" is hardcoded empty** — `app/(app)/payments/page.tsx:182` always says "No overdue clients yet," even with real overdue invoices.
- **Activity/Audit filters are a lie at scale** — `app/(app)/activity/activity-timeline-client.tsx:34` always calls `getGlobalTimeline({})`; the backend's entityType/user/date filtering is never invoked. All filtering/search is client-side over the first 50 rows (`components/activity/activity-timeline.tsx:63`), so it silently hides older events; Load More has no pending state and can double-append; load errors render as the empty state.
- **Signup success message contradicts itself** — `components/auth/signup-form.tsx:27` toasts "Please sign in" and redirects to login, but the action returns "check your email to verify" (`app/actions/auth.ts:181`). If email confirmation is on, the user is told to sign in but can't.

### Significant UX
- **Proposals/Leads module bypasses app conventions wholesale** — fire-and-forget mutations with **no toast and no error handling**: `updateLeadStatus` (`lead-detail-client.tsx:108`), `createLead` closes silently (`add-lead-dialog.tsx:23`), `approveAndSendQuotation` only `router.refresh()` for a client-facing email (`quotation-detail-client.tsx:55`). Optimistic updates never roll back on failure.
- **Quotation "Download PDF" (staff) has no loading/error state** — plain `<a download>` to a rate-limited (429) / 500-capable server route (`quotation-detail-client.tsx:105`, `quotation-list-table.tsx:114`); on error the browser downloads a broken/text file.
- **"Approve & Send" emails the client with no confirmation dialog and no success toast** — irreversible, client-visible, one click (`quotation-detail-client.tsx:51`).
- **`respondToQuotation` has no try/catch** — `app/actions/proposals.ts:416` — an unexpected DB throw leaves the external client stuck on a spinning Accept button with no message.
- **Kanban is mouse-only and not mobile-usable** — HTML5 `draggable` (no touch), six fixed `w-80` columns, no optimistic move, full refetch on drop (`kanban-board.tsx:83`).
- **Documents shows a *simulated* upload progress bar** — `components/documents/document-upload.tsx:172` fakes progress via `setInterval` while the **real** XHR progress is computed and discarded (`document-vault-client.tsx:154`, `_uploadProgress`).
- **Reports exports have no loading state and invisible failures** — `window.open` with no spinner (`reporting-center-client.tsx:200`); 401/403/500 render as raw JSON in a popped tab; no empty states; wide tables lack mobile scroll.
- **Employee disable/enable has no confirm and no pending state** — `components/employees/employees-page-client.tsx:92` — affects login/session; double-click risk.
- **Class `ErrorBoundary` (wraps the whole app) only `console.error`s** — `components/error/error-boundary.tsx:28` — client-render crashes here are NOT reported to observability, unlike the route `error.tsx` boundaries (which correctly call `reportError`).

---

## 4. P2 / P3 — Minor & Polish (selected)

- **Duplicate nav rows → same route** — `lib/navigation.ts:55,91,143` — "Client Master"+"Client Onboarding"→`/clients`; "Lead Pipeline"+"Quotations"→`/proposals`; "Messaging"+"Email Automation"→`/messaging`. Six rows, three destinations; both highlight active together; "Email Automation" is a phantom feature.
- **Sidebar "Quick Actions" mislabel** — `components/layout/app-sidebar.tsx:56` — "New Client/Task/Invoice" just navigate to list pages, don't open create forms (only "New Quote" actually starts creation).
- **No password-strength meter**; requirements only enforced on submit (`signup-form.tsx`, `update-password-form.tsx`).
- **Notification bell "Dismiss" (X) doesn't dismiss** — `components/notifications/notification-bell.tsx:259` — it only closes the whole panel.
- **SSR-fetched notifications discarded, refetched on client** — `app/(app)/notifications/page.tsx:16` → prop renamed `_initialNotifications` (unused); first-paint flash.
- **"Real-time updates enabled" is hardcoded** — `notifications-client.tsx:489` — no connection-state tracking; lies during an outage.
- **Setup-checklist dismissal doesn't persist** (local `useState`, `setup-checklist.tsx:66`); Manager view hardcodes `hasDocuments/hasInvoices: true`.
- **Employee dashboard completion % undercounts** (`take: 20` cap, `app/(app)/page.tsx:408`); Manager "Recent Activity" fetched-empty and unused.
- **Search inputs hit the DB on every keystroke** (no debounce) in work-tracker, documents, activity → request bursts + out-of-order results.
- **Export ignores active filters** — clients "Export" dumps the full unfiltered list (`clients-page-client.tsx:26`).
- **Client 360 relabels the task list as "activity"/"timeline"** (`client-360-client.tsx:436,586`); raw enum labels shown (`ON_HOLD`) vs friendly labels used in the table.
- **Onboarding wizard swallows step-save errors silently** — `components/onboarding/onboarding-wizard.tsx:291` (only `console.error`).
- **Two competing `EmptyState` components** (`components/ui/empty-state.tsx` vs `components/empty-states/empty-states.tsx`, both exporting `EmptyState`).
- **Reset-password shows no persistent "check your email" state** (toast-only, `reset-password-form.tsx:24`).
- **Ageing bar chart height math mismatched** (`payments/page.tsx:156`); no zero-invoice empty state.
- **Portal client-side upload has no size check** (10 MB enforced server-side only, `upload-form.tsx:46`); portal download errors are silent to the client (`download-button.tsx:16`).
- **Icon-only download buttons lack aria-labels** (documents grid/list, quotation list).
- **Recurring-template `description` field never populated**; **quotation terms fall back to hardcoded legal boilerplate** the firm never authored (`q/[token]/page.tsx:154`).

---

## 5. Systemic UX themes (the through-line)

1. **Loading feedback is nearly absent.** One global full-screen `app/loading.tsx` (a `fixed inset-0` overlay that hides the whole shell); **zero** route-level `loading.tsx` across ~24 routes; skeletons exist (`TableSkeleton`, `Skeleton`) but aren't deployed at route boundaries. Navigation feels like blank-screen stalls.
2. **Mutation feedback is ~45% covered and clusters by module.** `useValidatedForm` (Zod + inline errors + toast + submit-guard) is excellent where used (~8 forms) but the proposals/leads/quotations and settings flows hand-roll their own and go silent.
3. **The `canSubmit` dead-button anti-pattern persists.** The team fixed it in the 3 auth forms (`8b34833`, `136ef35`) but the identical hard-disable-with-no-feedback gate still strands users in `add-employee-dialog.tsx:171`, `add-compliance-event-dialog.tsx:279`, `add-invoice-dialog.tsx`, `client-onboarding-wizard.tsx:428`, and `document-upload.tsx:351`.
4. **No themed confirm dialog.** ~5–6 destructive actions use native `window.confirm()` and errors use native `alert()` — visually clashing with the dark UI; several destructive actions (lead delete, task delete) have **no** confirm at all. There is no `AlertDialog` primitive.
5. **Accessibility is mid-tier.** Strong Radix primitives (Dialog/Sheet focus-trapped), but ~44% of icon-only buttons have no accessible name, **no skip-to-content link**, ~0 `aria-live` regions, and 25+ unlabeled calendar day buttons.
6. **Dark-mode-only, hardcoded.** `<html className="dark">` with no toggle/`next-themes`, despite a complete light palette in `globals.css` sitting unused; several components bypass tokens with raw `*-500` colors.
7. **"Built twice/thrice" duplication** recurs: two EmptyState systems, two nav export styles, three help centers, two tour systems, a duplicate unguarded `actions/payments.ts`.

---

## 6. Dead code & landmines (delete or fence off)

These are **not** live features, but several would emit fake data or unauthenticated writes if a future caller wires them up:

- **`actions/payments.ts`** — duplicate `createInvoice`/`addPaymentReceipt`/… with **no auth checks**; unused. Unauthenticated-mutation footgun.
- **`lib/commercial/export.ts`** — every exporter returns hardcoded fake rows ("Example Client", `27ABCDE1234F1Z5"); "xlsx" is `JSON.stringify`. Unused (real exports live in `app/(app)/reports/export/route.ts`).
- **`lib/commercial/import.ts`** — increments `imported++` with all `prisma.*.create` calls commented out → reports success, writes nothing.
- **`lib/commercial/billing.ts`** — Stripe stub returning fake `sub_/inv_` ids and hardcoded ₹/$149.
- **`lib/notifications/sms.ts` & `email.ts`** — `console.log`-only stubs returning `{success:true}`; imported nowhere (the real email path is `resend-provider.ts`).
- **`components/messaging/whatsapp-chat.tsx`** — dead; fabricates delivered→read receipts via `setTimeout`; `loadMessages` returns `[]`.
- **`components/dashboard/alerts-panel.tsx`**, **`components/layout/page-placeholder.tsx`** ("This module is ready for implementation"), **help-center/tour** components — all unmounted.
- **Settings → Billing card** — static "Professional Plan" / "Contact your administrator" (`settings-page-client.tsx:746`); the one visible non-functional section.

---

## 7. Known operational gaps (from the project's own docs, still pending)

- **RLS not activated** — `002_rls_policies.sql` generated (36 tables/56 policies) but not run in Supabase; app currently relies on service-role + app-layer guards only.
- **`003_firm_settings_domain.sql` not run**; **`PLATFORM_FROM_EMAIL` not set** (email domain-verification fallback unavailable).
- **In-memory rate limiter** resets on serverless cold starts (Upstash migration documented, not done).
- **Zero automated tests** for the app (only 3 unit tests: firm-settings/roles/validations). No E2E.
- **WhatsApp not configured** (`WHATSAPP_API_TOKEN`/`_PHONE_NUMBER_ID`) — and note the messaging UI sends email regardless (§2).

---

## 8. Recommended fix sequence (highest leverage first)

1. **Fix the external-facing surfaces** (reputational): Client Portal Sign Out, Pay/Download/New Message/Retry (wire or hide-with-tooltip), portal `not-found.tsx` + client PDF; quotation-portal invalid/expired page.
2. **Fix the two runtime-breaking Next 16 async-params bugs** (`employees/[id]`, `client/documents`).
3. **Reconcile Messaging** — either route through `whatsapp-api.ts` or relabel the module as email; escape/​wrap message HTML.
4. **Kill the misleading data** — remove hardcoded dashboard trends, the 40% progress constants, the fake "workload %", the hardcoded "Action Needed" panel, the simulated upload bar; wire Activity's server-side filters.
5. **Wire the orphaned actions to UI** — task edit/delete, invoice delete, template edit/delete, bulk reminders; fix compliance status desync.
6. **Systematize UX** — add route-level `loading.tsx`; a shared themed `ConfirmDialog` (replace all `confirm()`/`alert()`); route proposals/settings through `useValidatedForm`; remove the residual `canSubmit` hard-gates; one pass for icon-button `aria-label`s + a skip link.
7. **Mount or delete** the help center + guided tours; **delete** the dead stubs in §6.
8. **Fix the recurring-engine date math** to match statutory dates and dedupe compliance reminder emails.

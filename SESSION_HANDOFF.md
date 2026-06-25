# J-TACS Session Handoff

**For:** Next Claude Code session
**Date of prior session:** 2026-06-10 (Session 15 — Firm-Branded Email System)
**Branch:** `main`
**Working directory:** `C:\Users\Jnanottam\OneDrive\Documents\j-tax` (rename to `j-tacs` planned)

---

## SESSION 15 SUMMARY

White-labelled the entire outbound email pipeline. Every production sender now reads `firm_settings` per-send via `getFirmSettings()` — no module constants, no env-var fallbacks at runtime, no hardcoded "TaxWise Consultants" / `noreply@taxwiseconsultants.com` left in production paths. Added Phase 8 domain verification: DNS instructions, live `dns/promises` checks, verified-vs-fallback envelope resolver, in-app PARTNER UI, and `/docs/email-setup` admin guide.

**Routes:** 47 (+1)
**Build / TypeScript / Lint:** all green (0 errors, 255 warnings — baseline)
**Runtime certification:** 11/11 PASS — see `FIRM_BRANDED_EMAIL_CERTIFICATION.md`

**Pending operator actions:**
1. Run `prisma/migrations-manual/003_firm_settings_domain.sql` in Supabase SQL editor (idempotent).
2. Set `PLATFORM_FROM_EMAIL` env var to a Resend-verified address on the platform domain.
3. PARTNER → `/settings` → configure Firm Details + DNS records for own-domain verification.

---

## QUICK STATUS

```
Build:      46 routes ✅  (npm run build — compiled successfully)
TypeScript: 0 errors  ✅  (npx tsc --noEmit)
Lint:       0 errors  ✅  (npm run lint) — 254 warnings, all warn-level
DB:         Synced    ✅  (no schema changes this session)
RLS:        36/36     ✅  (SQL certified; pending Supabase activation)
```

```bash
npm run dev    # → http://localhost:3000
# Login: admin@jtacs.test / JTacs@Admin2026!  (PARTNER role)
```

---

## WHAT WAS DONE IN SESSION 14

### Database Security Certification — Row-Level Security (RLS)

**Problem:** Session 12 generated RLS for 12 tables, but the database has 36 tables. 24 tables — including payment records, document versions, task comments, workforce data, quotation items, and timeline events — had zero RLS protection. Any direct API/PostgREST call could bypass all application-layer guards.

**Solution:** Complete rewrite of `002_rls_policies.sql`. Note: helper functions are in the `jtacs_auth` schema — Supabase blocks writes to the `auth` schema (`ERROR: 42501`), so a dedicated schema is required.

| Metric | Before (S12) | After (S14) |
|--------|-------------|-------------|
| Tables with RLS | 12 / 36 | **36 / 36** |
| Policies | ~24 | **56** |
| Helper functions | 2 (plain) | **2 (SECURITY DEFINER)** |
| Idempotent | No | **Yes** (DROP + re-create) |
| Transaction-wrapped | No | **Yes** |
| Verification queries | 2 | **5 + 10 simulations** |
| Activation guide | None | **Full guide created** |

### Key Security Decisions

1. **`jtacs_auth` schema** — Helper functions live in a dedicated `jtacs_auth` schema. Supabase's `auth` schema is read-only; attempting `CREATE FUNCTION auth.*` fails with `ERROR: 42501: permission denied for schema auth`. The functions call Supabase built-ins (`auth.jwt()`, `auth.uid()`) internally — those are accessible from any schema.

2. **EMPLOYEE scoping** — All EMPLOYEE access is scoped through `assignedEmployeeId` on the `clients` table. Child tables (documents, tasks, compliance events, etc.) use `EXISTS` subqueries that join through the parent chain.

3. **`jtacs_auth.employee_id()` is SECURITY DEFINER** — Runs as postgres to bypass RLS on the `employees` table when resolving the caller's own Employee.id, preventing a circular dependency.

4. **No CLIENT policies** — CLIENT users access data exclusively through the client portal (which uses the service-role key). No direct DB access is permitted.

5. **Service-role bypass** — The Next.js backend uses `SUPABASE_SERVICE_ROLE_KEY` for all Prisma operations, which bypasses RLS. The policies protect against direct API/PostgREST access only.

### Access Pattern Summary

| Pattern | Tables |
|---------|--------|
| PARTNER-only | `audit_logs`, `activity_logs` |
| PARTNER write / staff read | `firm_settings`, `"User"`, `recurring_compliance_templates` |
| PARTNER+MANAGER only | `invoices`, `payment_receipts`, `follow_ups`, `invoice_reminders`, `leads`, `quotations`, `quotation_items`, `quotation_email_logs`, `quotation_follow_ups`, `task_automations` |
| PARTNER+MANAGER full / EMPLOYEE scoped read | `clients`, `client_services`, `compliance_schedules`, `documents`, `document_versions`, `document_tags`, `document_activities`, `messages`, `message_logs`, `reminders`, `client_timeline_events` |
| PARTNER+MANAGER full / EMPLOYEE scoped write | `tasks`, `task_comments`, `task_attachments`, `compliance_events` |
| Workforce (PARTNER full / MANAGER read / EMPLOYEE own) | `employee_sessions`, `employee_activities`, `attendance_records` |
| Own-records only | `notifications` |

### Files Changed

| File | Change |
|------|--------|
| `prisma/migrations-manual/002_rls_policies.sql` | **Rewritten** — 36 tables, 56 policies, `jtacs_auth` schema, idempotent |
| `prisma/migrations-manual/RLS_ACTIVATION_GUIDE.md` | **New** — step-by-step activation, verification, rollback |
| `PROJECT_STATE.md` | Updated RLS status |
| `FIX_LOG.md` | Session 14 entries (RLS-001 through RLS-002); RLS-002 documents the `jtacs_auth` schema fix |
| `SESSION_HANDOFF.md` | This file |

---

## REMAINING WORK (priority order)

### CRITICAL
1. Configure Firm Settings via `/settings` (PARTNER login required)
2. **Run `002_rls_policies.sql` in Supabase SQL editor** — see `RLS_ACTIVATION_GUIDE.md`
3. Verify `RESEND_API_KEY` set in production env

### HIGH
4. Upstash Redis rate limiter (in-memory resets on cold starts)

### MEDIUM
5. Playwright E2E test suite (0 automated tests)

### LOW
6. WhatsApp Business API (`WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`)
7. Verify Supabase `documents` storage bucket exists

# Rebranding Audit Report — J-TAX → J-TACS

**Date:** 2026-06-11
**Scope:** Full repository sweep, replacing J-TAX brand with J-TACS across user-visible text, metadata, code identifiers, storage keys, RLS schema, documentation, scripts, and tests.
**Functionality changed:** None. Behaviour, routes, RBAC, and data models are unchanged.

---

## 1. Verification Status

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 264 warnings (baseline) |
| `npm run build` | ✅ Compiled successfully — 47 routes |
| `npm test` | ✅ 46 / 46 PASS |
| Dev server boot (`/login`, `/signup`) | ✅ Renders, no console errors |
| Browser title | ✅ `J-TACS | Enterprise Tax Dashboard` |
| Logo aria-label + wordmark | ✅ `J-TACS` |

---

## 2. Files Changed (38 files)

### UI / Components (10)
| File | Change |
|------|--------|
| [app/layout.tsx](app/layout.tsx) | Browser title metadata `J-TAX | …` → `J-TACS | …` |
| [components/ui/logo.tsx](components/ui/logo.tsx) | Logo aria-label, comment, wordmark `J-TAX` → `J-TACS` (5 occurrences) |
| [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx) | Heading `Sign in to J-TAX` → `Sign in to J-TACS` |
| [app/(auth)/signup/page.tsx](app/(auth)/signup/page.tsx) | Sub-text `Join J-TAX …` → `Join J-TACS …` |
| [components/client-portal/client-sidebar.tsx](components/client-portal/client-sidebar.tsx) | Sidebar brand label `J-TAX Portal` → `J-TACS Portal` |
| [components/onboarding/onboarding-wizard.tsx](components/onboarding/onboarding-wizard.tsx) | `J-TAX Setup` chip + employee step description |
| [components/onboarding/help-center.tsx](components/onboarding/help-center.tsx) | "Integrate J-TAX with your tools" → J-TACS |
| [components/onboarding/guided-tours.tsx](components/onboarding/guided-tours.tsx) | Body copy + `jtax.completedTours` localStorage key → `jtacs.completedTours` |
| [components/help-center/help-center.tsx](components/help-center/help-center.tsx) | 5 FAQ/guide strings + tutorial description |
| [components/dashboard/setup-checklist.tsx](components/dashboard/setup-checklist.tsx) | Card title `Get started with J-TAX` |
| [components/clients/clients-page-client.tsx](components/clients/clients-page-client.tsx) | Page header description |
| [components/settings/settings-page-client.tsx](components/settings/settings-page-client.tsx) | DNS hint `_jtax-verify` → `_jtacs-verify` |
| [components/notifications/notifications-provider.tsx](components/notifications/notifications-provider.tsx) | localStorage key `jtax.notifications.sound` → `jtacs.notifications.sound` |

### Pages / Routes (1)
| File | Change |
|------|--------|
| [app/(app)/docs/email-setup/page.tsx](app/(app)/docs/email-setup/page.tsx) | Page title, header description, two `_jtax-verify` host references |

### Server Actions / Library (4)
| File | Change |
|------|--------|
| [lib/firm-settings.ts](lib/firm-settings.ts) | `_jtax-verify.${domain}` DNS host → `_jtacs-verify.${domain}` |
| [app/actions/onboarding.ts](app/actions/onboarding.ts) | `jtax-verify=…` token prefix → `jtacs-verify=…` |
| [app/actions/settings.ts](app/actions/settings.ts) | 3 occurrences: token generation (×2) + DNS lookup prefix |
| [lib/observability/report-error.ts](lib/observability/report-error.ts) | Log prefix `[jtax-error]` → `[jtacs-error]` |

### Stores (2)
| File | Change |
|------|--------|
| [lib/stores/sidebar-store.ts](lib/stores/sidebar-store.ts) | Zustand persist name `j-tax-sidebar-state` → `j-tacs-sidebar-state` |
| [lib/clients/onboarding-store.ts](lib/clients/onboarding-store.ts) | Persist name `j-tax-client-onboarding` → `j-tacs-client-onboarding` |

### Security (4)
| File | Change |
|------|--------|
| [lib/security/security-headers.ts](lib/security/security-headers.ts) | File header comment `Security Headers for J-TAX` |
| [lib/security/rate-limiter.ts](lib/security/rate-limiter.ts) | File header comment |
| [lib/security/audit-logger.ts](lib/security/audit-logger.ts) | File header comment |
| [lib/security/index.ts](lib/security/index.ts) | File header comment |

### Database / Migrations (2)
| File | Change |
|------|--------|
| [prisma/migrations-manual/002_rls_policies.sql](prisma/migrations-manual/002_rls_policies.sql) | Schema rename `jtax_auth` → `jtacs_auth` (≈128 references); header comment; `J-TAX` → `J-TACS` |
| [prisma/migrations-manual/004_rls_compliance_events_tightening.sql](prisma/migrations-manual/004_rls_compliance_events_tightening.sql) | `jtax_auth.*` → `jtacs_auth.*` (4 refs); FINDING-RLS-001 header reference |

### Scripts / Tests (5)
| File | Change |
|------|--------|
| [scripts/verify-storage.mjs](scripts/verify-storage.mjs) | Console banner |
| [scripts/firm-email-certify.ts](scripts/firm-email-certify.ts) | `notifications@jtax.app` → `notifications@jtacs.app`; `jtax-verify=…` token literal; DNS prefix |
| [scripts/rls-certify.ts](scripts/rls-certify.ts) | `jtax_auth` schema/function refs (≈20); banner |
| [scripts/rls-helper-smoke.ts](scripts/rls-helper-smoke.ts) | `jtax_auth.user_role()` SQL calls |
| [tests/firm-settings.test.ts](tests/firm-settings.test.ts) | Test fixtures: token, fallback email, host pattern, test name |

### Project Configuration (3)
| File | Change |
|------|--------|
| [package.json](package.json) | `"name": "j-tax"` → `"j-tacs"` |
| [package-lock.json](package-lock.json) | Two `"name": "j-tax"` keys at top + root package |
| [.claude/launch.json](.claude/launch.json) | Dev-server config name `j-tax-dev` → `j-tacs-dev` |

### Documentation (10)
- [PROJECT_STATE.md](PROJECT_STATE.md)
- [FIX_LOG.md](FIX_LOG.md)
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- [CERTIFICATION_SCORECARD.md](CERTIFICATION_SCORECARD.md)
- [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md)
- [RLS_CERTIFICATION.md](RLS_CERTIFICATION.md)
- [FIRM_BRANDED_EMAIL_CERTIFICATION.md](FIRM_BRANDED_EMAIL_CERTIFICATION.md)
- [NOTIFICATIONS_README.md](NOTIFICATIONS_README.md)
- [CLIENT_PORTAL_README.md](CLIENT_PORTAL_README.md)
- [CUSTOMER_SUCCESS_README.md](CUSTOMER_SUCCESS_README.md)
- [prisma/migrations-manual/RLS_ACTIVATION_GUIDE.md](prisma/migrations-manual/RLS_ACTIVATION_GUIDE.md)

All `J-TAX` brand strings replaced with `J-TACS`; `jtax_auth` schema, localStorage keys, DNS host prefixes, log prefixes, and test credentials updated.

---

## 3. Identifier-Level Mapping

| Old | New | Where |
|-----|-----|-------|
| `J-TAX` | `J-TACS` | UI titles, headings, copy |
| `j-tax` (project name) | `j-tacs` | `package.json`, `package-lock.json`, launch config |
| `jtax_auth` (Postgres schema) | `jtacs_auth` | RLS migrations, certification scripts |
| `_jtax-verify.<domain>` (DNS host) | `_jtacs-verify.<domain>` | Settings UI, email setup docs, `lib/firm-settings.ts`, tests |
| `jtax-verify=<hex>` (challenge token) | `jtacs-verify=<hex>` | `app/actions/settings.ts`, `app/actions/onboarding.ts`, scripts |
| `j-tax-sidebar-state` (Zustand persist key) | `j-tacs-sidebar-state` | `lib/stores/sidebar-store.ts` |
| `j-tax-client-onboarding` | `j-tacs-client-onboarding` | `lib/clients/onboarding-store.ts` |
| `jtax.notifications.sound` (localStorage) | `jtacs.notifications.sound` | `components/notifications/notifications-provider.tsx` |
| `jtax.completedTours` (localStorage) | `jtacs.completedTours` | `components/onboarding/guided-tours.tsx` |
| `[jtax-error]` (console prefix) | `[jtacs-error]` | `lib/observability/report-error.ts` |
| `notifications@jtax.app` (platform default) | `notifications@jtacs.app` | scripts, tests |
| `admin@jtax.test` (test credential) | `admin@jtacs.test` | docs only |
| `JTax@Admin2026!` (test password) | `JTacs@Admin2026!` | docs only |

---

## 4. Remaining References (Intentional)

These references are **not** brand text and were intentionally left in place:

| Reference | Reason |
|-----------|--------|
| Working directory path `C:\Users\…\Documents\j-tax` (in SESSION_HANDOFF.md only) | The on-disk folder name is `j-tax`. Renaming the directory requires user action and would invalidate IDE history, shell shortcuts, and any user-side absolute paths. Documented in handoff as "rename to `j-tacs` planned." |
| Database user account `admin@jtax.test` if already provisioned | The new docs reference `admin@jtacs.test`. If the Supabase test user has not been re-created, the operator must either (a) re-seed and create the new test user, or (b) keep using the old email until they do. **This is the only functional follow-up.** |
| `taxwiseconsultants.com`, "TaxWise Consultants" in tests | These are placeholder firm names for test fixtures — they represent a sample customer firm, never the J-TAX/J-TACS brand. Unchanged. |

A repo-wide search for `J-TAX`, `J-Tax`, `JTAX`, `JTax`, `jtax`, `j-tax` after the rebrand returns **only** the intentional working-directory reference above.

---

## 5. Operator Follow-Up (one-time)

1. **Optional — rename working directory**:
   `j-tax/` → `j-tacs/` (and update shell shortcuts / IDE workspace).
2. **Test user account** — if the seed user `admin@jtax.test` exists in Supabase, re-create it as `admin@jtacs.test` (or update the docs back). The app does not depend on either string; only the docs do.
3. **RLS not yet activated** — when the RLS migration is finally applied to Supabase, it will create the `jtacs_auth` schema (matching the rewritten SQL). Anyone who already applied an earlier draft with `jtax_auth` should drop that schema first (`DROP SCHEMA jtax_auth CASCADE;`) and re-run `002_rls_policies.sql`.
4. **In-flight DNS verification tokens** — any firm that already published `_jtax-verify.<domain>` will fail the live DNS check until they re-publish at `_jtacs-verify.<domain>`. The settings UI generates a fresh token on next save, so simply re-saving Firm Details produces a new instruction set. No firm domain has been verified in production yet (per `PROJECT_STATE.md`).
5. **localStorage state loss** — users will lose their persisted sidebar favorites, completed-tour markers, in-progress client onboarding draft, and notification-sound preference on first reload after deploy. These are recoverable in one click each.

No functionality was changed by this rebrand.

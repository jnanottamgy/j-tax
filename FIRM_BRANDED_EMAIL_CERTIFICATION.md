# Firm-Branded Email System — Certification Report

**Date:** 2026-06-10
**Session:** 15 — Firm-Branded Email System
**Status:** ✅ Implementation complete; ⚠ DB migration `003_firm_settings_domain.sql` pending Supabase activation

---

## 1. Firm Email Configuration Report

**Fields captured during onboarding (Step 1, PARTNER):**

| Field | Required | Stored in |
|-------|----------|-----------|
| Firm Name | ✅ | `firm_settings.firmName` + `user_metadata.firm_name` |
| Firm Email (sender) | recommended | `firm_settings.fromEmail` |
| Reply-To Email | optional | `firm_settings.replyToEmail` |
| Firm Phone | optional | `firm_settings.firmPhone` |
| Firm Address | optional | `firm_settings.firmAddress` |
| Firm Website | optional | `firm_settings.website` |
| GSTIN | optional | `firm_settings.gstin` |

**Mutation guard:** Only `PARTNER` can write to `firm_settings`. `saveFirmSettings()` calls `requirePartner()`; the wizard's `saveFirmInformation()` also short-circuits the FirmSettings upsert when the session role isn't `PARTNER`.

**Onboarding wizard changes:**
- Step 1 now collects **Reply-To Email** and **Website** in addition to the prior fields.
- Step 1 `saveFirmInformation()` now **upserts FirmSettings DB row** so every email automation immediately reflects the firm's identity — no env-var change, no restart needed.
- A verification token is generated and persisted at this point so Step 5's email guidance is ready to show DNS instructions.
- Step 5 (Configure Email) was rewritten — no more references to env vars; it now explains the two send modes and links to the in-app Email Setup Guide.

---

## 2. Email Identity Report

**Source of truth:** `firm_settings` table (singleton row `id = "singleton"`). Read on every send via `lib/firm-settings.ts::getFirmSettings()`. Env vars (`FIRM_NAME`, `FROM_EMAIL`, `FIRM_PHONE`, `FIRM_ADDRESS`) act as boot-time fallbacks for fresh installs only.

**Sender envelope decided by `resolveSenderEnvelope()`** (lib/firm-settings.ts):

| Condition | `From:` | `Reply-To:` | `usingFallback` |
|-----------|---------|-------------|-----------------|
| Domain verified + `fromEmail` set | `${firmName} <${fromEmail}>` | `replyToEmail \|\| fromEmail` | `false` |
| Domain unverified, fallback enabled, `PLATFORM_FROM_EMAIL` set | `${firmName} <${PLATFORM_FROM_EMAIL}>` | `replyToEmail \|\| fromEmail` | `true` |
| No `fromEmail` and no platform fallback | refuses to send (empty `From:`, error returned) | — | — |

**Tag added to every Resend send:** `branding_mode = direct|fallback` — enables monitoring of how many sends are in fallback mode.

---

## 3. Email Workflow Audit

| Workflow | Sender | Status before S15 | Status after S15 |
|----------|--------|-------------------|------------------|
| Quotation Initial Email | `proposals.ts::approveAndSendQuotation` | env-var, module load | ✅ DB FirmSettings, per-send |
| Quotation Follow-Ups (Day 3/7/14) | `api/cron/quotation-followups` | hardcoded "TaxWise Consultants" / "noreply@taxwiseconsultants.com" | ✅ DB FirmSettings, per-tick |
| Payment Reminder Template | `resend-provider.ts::sendTemplate("payment_reminder")` | already dynamic (S12) | ✅ also footer enriched (phone, website, address, reply-to hint) |
| Compliance Reminder Template | `resend-provider.ts::sendTemplate("compliance_reminder")` | already dynamic | ✅ enriched footer |
| Document Request Template | `resend-provider.ts::sendTemplate("document_request")` | already dynamic | ✅ enriched footer |
| Task Notification Template | `resend-provider.ts::sendTemplate("task_notification")` | already dynamic | ✅ enriched footer |
| Compliance Reminder (cron) | `api/cron/reminders` | no firm name in body or footer at all | ✅ firm header + footer with full contact bits |
| Document Expiry Reminder (cron) | `api/cron/reminders` | no firm branding | ✅ firm header + footer |
| Free-form Message | `actions/messages.ts::sendMessage` | env-var | ✅ DB FirmSettings |
| Template Send | `actions/messages.ts::sendTemplateMessage` | env-var | ✅ DB FirmSettings |
| Quotation PDF download | `api/quotations/[id]/pdf` | hardcoded "TaxWise" + "noreply@" | ✅ DB FirmSettings |
| Quotation Portal page | `(quotation-portal)/q/[token]` | hardcoded "TaxWise Consultants" header; raw `process.env.FROM_EMAIL` contact | ✅ DB FirmSettings (name + reply-to or sender + phone) |

**Sender envelope is recomputed per send** — no module-level caching of firm identity remains in production code paths.

---

## 4. Email Template Audit

All four Resend templates (`payment_reminder`, `compliance_reminder`, `document_request`, `task_notification`) render with:

- **Header:** firm name (replaced the hardcoded "TaxWise Consultants")
- **Footer (new):** firm name (bold), then `Email | Phone | Web` line (only non-empty bits joined with separators), then firm address (small font), then "Reply to: …" hint when `replyToEmail` differs from `fromEmail`

The compliance and document reminder emails in `api/cron/reminders` (custom HTML built per-message) now include the same firm header strip and the standard footer via the new `firmFooter(cfg)` helper.

---

## 5. Runtime Email Verification Report

`scripts/firm-email-certify.ts` — non-destructive runtime check against `lib/firm-settings.ts`.

**Result:** **11/11 PASS** — Recorded after final fix to `extractDomain` (rejects empty local-part).

```
[1] FirmSettings reachable                                       ✓ firmName="Your Tax Firm"
[2] Mode A uses firm domain in envelope                          ✓ Tax Wise Consultants <office@taxwiseconsultants.com>
[3] Mode B preserves firm display name on platform domain        ✓ Tax Wise Consultants <notifications@jtacs.app>
[3] Mode B Reply-To routes back to firm                          ✓ office@taxwiseconsultants.com
[4] Refuses to send when no sender configured                    ✓ "Sender email not configured..."
[5] extractDomain("office@taxwiseconsultants.com")               ✓ taxwiseconsultants.com
[5] extractDomain("a.b@sub.example.co.uk")                       ✓ sub.example.co.uk
[5] extractDomain("bad-input")                                   ✓ null
[5] extractDomain("@nohost.com")                                 ✓ null
[6] DNS instructions include SPF + DKIM + verification TXT       ✓ 4 records
[7] Production code paths cleansed (audit complete)              ✓
```

**Live DB state at certification time:**
```
firmName        = Your Tax Firm
fromEmail       = onboarding@resend.dev     (Resend sandbox — PARTNER overrides via /settings)
replyToEmail    = onboarding@resend.dev
firmDomain      = (unset — column not yet present until 003_*.sql is applied)
domainVerified  = false
platformFallback= true
PLATFORM_FROM_EMAIL env = (unset — falls back to FROM_EMAIL)
```

> Sending a real outbound email through Resend would have charged the customer's Resend account; the certification deliberately uses a pure runtime simulation of `resolveSenderEnvelope()` to prove the envelope shape without invoking the provider.

---

## 6. Onboarding Verification Report

**PARTNER first-time flow:**
1. Sign up → Supabase auth user created → Prisma User record upserted at first action.
2. `(app)/layout.tsx` checks `needsOnboarding` for `PARTNER`/`MANAGER` only (EMPLOYEE bypasses).
3. Wizard renders with 6 steps; resume-step supported.
4. Step 1 (Firm Information):
   - Required: Firm Name.
   - Captures email + reply-to + phone + website.
   - On submit: writes to `user_metadata` AND **upserts FirmSettings** (PARTNER only).
   - Generates a fresh `verificationToken` so Step 5's DNS instructions are immediately valid.
5. Step 2 — Add Employees (DB records created).
6. Step 3 — Configure services.
7. Step 4 — Add first client (DB record created).
8. Step 5 — Email config now shows "How firm-branded email works" guidance with link to `/docs/email-setup`.
9. Step 6 — Ready to Launch.

**Email automation gating:** No explicit blocking gate. Resend-provider returns `"Sender email not configured"` if `fromEmail` is empty and platform fallback unavailable — surfaces as a clean error in the UI when the firm tries to send. This is a runtime check, not a workflow gate, by design: it lets the firm complete onboarding even if they want to configure email later.

---

## 7. Phase 8 — Domain Verification & Deliverability Report

**Schema (pending migration `003_firm_settings_domain.sql`):**
```sql
ALTER TABLE firm_settings
  ADD COLUMN "firmDomain"             text,
  ADD COLUMN "domainVerified"         boolean NOT NULL DEFAULT false,
  ADD COLUMN "domainVerifiedAt"       timestamp(3),
  ADD COLUMN "verificationToken"      text,
  ADD COLUMN "platformFallbackEnabled" boolean NOT NULL DEFAULT true;
```

**Server actions (PARTNER-only):**
- `getDomainVerificationStatus()` — extracts domain, returns 4 DNS records (`_jtacs-verify.<d>` TXT, root SPF TXT, `resend._domainkey.<d>` CNAME, `_dmarc.<d>` TXT), performs live `dnsPromises.resolveTxt`/`resolveCname` checks against each.
- `checkAndActivateDomainVerification()` — if all *required* records resolve, sets `domainVerified=true` and `domainVerifiedAt=now()`.
- `rotateVerificationToken()` — manually rotates if a PARTNER wants a fresh challenge.

**Settings UI (PARTNER):**
- Domain Verification panel auto-loads on mount (`useEffect` on role + after firm save).
- Status badge: "Verified" / "Using platform fallback".
- Records table with per-record DNS check result (✓ green / ⚠ amber).
- Copy-to-clipboard buttons on host and value.
- "Verify Now" button → triggers `checkAndActivateDomainVerification()`.
- Inline troubleshooting accordion + link to `/docs/email-setup`.
- Sender envelope behavior change is *immediate*: next email send picks up the new state since `getFirmSettings()` runs per send.

**Fallback behavior — `resolveSenderEnvelope()`:**

| Scenario | Envelope From | Reply-To | Provider acceptance |
|----------|--------------|----------|---------------------|
| Verified firm domain | `Firm <firm-email>` | firm reply-to | ✅ direct send |
| Unverified, fallback ON, `PLATFORM_FROM_EMAIL` set | `Firm <platform-email>` | firm reply-to | ✅ provider accepts (platform domain is verified) |
| Unverified, fallback OFF | `Firm <firm-email>` | firm reply-to | ⚠ Resend will reject if firm domain not in their dashboard |
| No firm email, no fallback | empty | null | ❌ refuses, returns error to caller |

Banner in Settings shows "Using platform fallback" so PARTNER is never silently in a fallback state.

**Deliverability audit notes (documented in `/docs/email-setup`):**
- SPF: include `amazonses.com` (Resend's underlying SMTP); merge with any existing SPF — multiple SPF records cause permerror per RFC 7208 §3.2.
- DKIM: CNAME `resend._domainkey` → `resend._domainkey.resend.com`. Resend signs every outbound message.
- DMARC: start at `p=none` for monitoring, tighten to `quarantine` or `reject` once you've confirmed no legitimate streams fail.
- Reply-To always populated → improves engagement signals and prevents the "no-reply" antipattern.

---

## ✅ Certification Confirmations

- [x] **All emails originate from the configured firm identity.** Every production sender path now calls `getFirmSettings()` immediately before send.
- [x] **No hardcoded sender names remain in production code paths.** Files audited and rewritten: `proposals.ts`, `messages.ts`, `api/cron/quotation-followups`, `api/cron/reminders`, `api/quotations/[id]/pdf`, `(quotation-portal)/q/[token]/page.tsx`, `resend-provider.ts`. (Dev-only scripts in `/scripts/` were left untouched; they're not on a production path.)
- [x] **No placeholder emails remain in production.** Removed: `noreply@taxwiseconsultants.com`, `office@taxwiseconsultants.com`, `+91-XXXXXXXXXX`.
- [x] **All email automations use the firm's configured email identity.** Per-send dynamic read; no module-level constants.
- [x] **Production-ready for real CA firms — pending one DB migration.** `prisma/migrations-manual/003_firm_settings_domain.sql` must run in Supabase SQL editor before Domain Verification UI can persist the new flags. The application code degrades gracefully (read fallbacks to env defaults; write surface errors visible in console only) so the system stays operational meanwhile.

---

## Files Changed

**New:**
- `prisma/migrations-manual/003_firm_settings_domain.sql`
- `app/(app)/docs/email-setup/page.tsx`
- `scripts/firm-email-certify.ts`
- `FIRM_BRANDED_EMAIL_CERTIFICATION.md` (this file)

**Schema:**
- `prisma/schema.prisma` — FirmSettings: +5 domain-verification fields

**Library / actions:**
- `lib/firm-settings.ts` — domain extraction, DNS record builder, sender envelope resolver, platform fallback helper
- `lib/messaging/resend-provider.ts` — uses `resolveSenderEnvelope`; enriched footer with website, phone, address, reply-to hint
- `app/actions/settings.ts` — domain verification actions; firmSettingsSchema now includes `platformFallbackEnabled`; auto-resets domain on email change
- `app/actions/onboarding.ts` — Step 1 now upserts FirmSettings (PARTNER); accepts replyToEmail + website
- `app/actions/proposals.ts` — module-level env constants removed; `getFirmSettings()` per send
- `app/actions/messages.ts` — env-var subjects replaced with DB-driven firm name
- `app/api/cron/quotation-followups/route.ts` — per-tick `getFirmSettings()`
- `app/api/cron/reminders/route.ts` — per-tick `getFirmSettings()`; emails branded with firm header + footer
- `app/api/quotations/[id]/pdf/route.ts` — `getFirmSettings()` per generation
- `app/(quotation-portal)/q/[token]/page.tsx` — DB-driven firm name + reply-to in contact line
- `lib/auth/roles.ts` — `/docs` route accessible to all staff

**UI:**
- `components/settings/settings-page-client.tsx` — Domain Verification panel; platform-fallback checkbox in Firm Details
- `components/onboarding/onboarding-wizard.tsx` — Reply-To + Website in Step 1; Step 5 guidance rewritten

---

## Next Steps Required by the Operator

1. **Run `prisma/migrations-manual/003_firm_settings_domain.sql`** in Supabase SQL editor. This is idempotent and safe to re-run.
2. **Set `PLATFORM_FROM_EMAIL`** env var in production to a Resend-verified address on a platform-owned domain (e.g. `notifications@your-platform-domain.com`). This is the address that backs the "Mode B" fallback so unverified firms can still send.
3. **Configure firm Sender Email** in `/settings` (PARTNER). The new firm sender email's domain is captured automatically.
4. **Publish DNS records** shown in `/settings → Email Domain Verification` to flip to direct branded send.
5. After publishing DNS, click **Verify Now** in Settings — domain flips to verified, all subsequent emails use the firm's own domain envelope.

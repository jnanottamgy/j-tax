---
name: reports-overstate-completeness
description: The ~40 QA/certification .md reports in j-tax overstate completeness; use GAP_ANALYSIS.md as ground truth
metadata:
  type: project
---

The J-TACS repo has ~40 `*_REPORT.md` / `*_CERTIFICATION.md` / `PROJECT_STATE.md` files that claim near-complete, production-ready status. A source-level audit on 2026-07-04 found this is **not** accurate — many features have a real backend but no UI entry point, several primary buttons are dead, some data is fabricated/placeholder shown as real, and both external-facing surfaces (Client Portal, public Quotation Portal) have broken core flows.

**Ground truth = `GAP_ANALYSIS.md`** (repo root), not the certification reports. When assessing state or picking work, trust code + that file over the celebratory reports.

Recurring anti-patterns to watch: (1) `disabled={!canSubmit}` dead-button hard-gates with no feedback (fixed in the 3 auth forms only; still in add-employee/add-compliance/add-invoice/onboarding/document-upload dialogs); (2) working server actions with no UI caller (task edit/delete, invoice delete, template edit/delete, bulk reminders); (3) native `window.confirm()`/`alert()` instead of a themed dialog (no `AlertDialog` primitive exists); (4) only one global `loading.tsx`, no route-level skeletons; (5) messaging "WhatsApp" actually sends email (`app/actions/messages.ts` `channel:"email"`). Dead/landmine modules: `actions/payments.ts` (unauthed), `lib/commercial/{export,import,billing}.ts`, `lib/notifications/{sms,email}.ts`, `components/messaging/whatsapp-chat.tsx`.

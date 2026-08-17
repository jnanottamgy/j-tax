# J-TACS user manuals

Three role-specific manuals for people using J-TACS for the first time.

| File | Pages | For |
|------|-------|-----|
| `partner-manual.pdf` | 23 | The Partner — the whole product, from creating the firm to the audit trail |
| `manager-manual.pdf` | 19 | Managers — running the work and the team, and where their authority stops |
| `employee-manual.pdf` | 14 | Employees — first login, daily task loop, hours, and what they cannot see |

Each ends with a one-page quick reference designed to be printed and kept on a desk.

## Rebuilding

```bash
python3 docs/manuals/build_all.py
```

Writes `<role>-manual.html` and `<role>-manual.pdf` into this directory. The HTML
is an intermediate and is not committed.

Rendering uses headless Chromium rather than a Python PDF library because it
supports CSS paged-media margin boxes, which is what produces the running footer
and real page numbers. `build_all.py` finds Chromium at the Playwright browser
path used in CI, or on `PATH`.

## Editing

- `manual_kit.py` — the shared design system and page components (covers,
  chapters, step lists, callouts, tables, pipeline diagrams, sidebar mocks,
  quick-reference cards). One accent colour per role is swapped here.
- `partner_manual.py`, `manager_manual.py`, `employee_manual.py` — the content
  of each manual, chapter by chapter.

## Keeping them true

The manuals describe behaviour that is enforced in code, not intentions. If any
of the following change, the manuals are wrong and must be updated:

| Claim in the manuals | Where it is enforced |
|---|---|
| Role capabilities and what each role is refused | `lib/auth/roles.ts` — `ROLE_CAPABILITIES`, `ROUTE_ACCESS` |
| Which screens each role sees | `lib/navigation.ts` — `getNavigationForRole` |
| Employees cannot mark work Filed / Done | `lib/auth/delegation.ts` — `canSignOffTask` |
| Task statuses and which moves need a reason | `lib/tasks/transitions.ts` |
| Assignment blocks vs warnings | `lib/tasks/assignment.ts` — `checkAssignment` |
| Decline reasons | `lib/tasks/transitions.ts` — `DECLINE_REASONS` |
| Only a Partner can grant the Manager role | `app/actions/employees.ts` — `issueEmployeeLogin` |
| Invoice approval limit behaviour | `app/actions/invoices.ts` — `resolveApprovalGate` |
| Paid / Partially paid are derived, not settable | `app/actions/invoices.ts` — `SETTABLE_STATUSES` |
| A draft invoice is never chased as overdue | `lib/billing/overdue.ts` |
| How worked minutes accrue, idle and stale thresholds | `lib/workforce/presence.ts` |
| The five onboarding steps | `components/clients/client-onboarding-wizard.tsx` |
| Client 360 tabs, and the two withheld from employees | `app/(app)/clients/[id]/client-360-client.tsx` |
| Lead and quotation stages | `prisma/schema.prisma` — `LeadStatus`, `QuotationStatus` |

# TODO - Employee Management module QA & Fix

## Step 1: Implement missing backend mutations + listing
- [ ] Update `app/actions/employees.ts`
  - [ ] Add `disableEmployee(employeeId)` and `enableEmployee(employeeId)` (set `isActive`)
  - [ ] Add `listEmployeesData(...)` supporting:
    - [ ] search query (name/email/department)
    - [ ] filters (department, isActive/status)
    - [ ] pagination (page, pageSize)
- [ ] Ensure RBAC is enforced via `requirePartnerOrManager()` for all mutations

## Step 2: Fix broken global-search employee URLs
- [ ] Add `app/(app)/employees/[id]/page.tsx`
  - [ ] RBAC: allow PARTNER/MANAGER to view/manage
  - [ ] Render employee info (and status)
  - [ ] Handle unauthorized/404 properly

## Step 3: Wire server-side listing into Employees pages
- [ ] Update `app/(app)/employees/page.tsx` to pass initial params/user role if needed
- [ ] Update `components/employees/employees-page-client.tsx`
  - [ ] Replace client-side search/filter with server-driven query
  - [ ] Add UI for search + filters + pagination
  - [ ] Call new `listEmployeesData` and handle loading/errors

## Step 4: Add enable/disable UI
- [ ] Update `components/employees/employees-table.tsx`
  - [ ] Add dropdown items for Disable/Enable based on `isActive`
  - [ ] Add callbacks to trigger new enable/disable actions
- [ ] Update `components/employees/employees-page-client.tsx` to call enable/disable + toast + refresh

## Step 5: Validation + negative tests
- [ ] Attempt invalid actions:
  - [ ] duplicate email
  - [ ] empty/too-short name
  - [ ] invalid role (ensure server rejects/ignores; RBAC enforced)
- [ ] Ensure errors are surfaced as fieldErrors / permission errors

## Step 6: Verification matrix
- [ ] Database persistence check (revalidate + prisma writes)
- [ ] Validation check
- [ ] RBAC check (unauthorized redirects)
- [ ] Search/filter/pagination correctness

## Step 7: Generate Operational Readiness Report
- [ ] Write `OPERATIONAL_READINESS_REPORT.md` section(s) for Employee module

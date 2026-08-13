/**
 * Delegation rules — who may sign off what.
 *
 * Both of these were previously inline in their server actions, untested, and
 * both had the same shape of hole: the rule was written for the role someone
 * had in mind rather than for every role that could reach the code.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { canSignOffTask, invoiceNeedsApproval } from "@/lib/auth/delegation"

describe("canSignOffTask — nobody signs off their own work", () => {
  test("an employee never files, even work assigned to them", () => {
    const v = canSignOffTask({
      role: "EMPLOYEE",
      actorEmployeeId: "emp_1",
      assignedEmployeeId: "emp_1",
    })
    assert.equal(v.allowed, false)
    assert.match(v.allowed === false ? v.reason : "", /Under Review/)
  })

  test("a manager cannot file work assigned to themselves", () => {
    // The regression this exists for: the old guard only checked EMPLOYEE, so a
    // Manager holding the task could prepare a filing and approve it.
    const v = canSignOffTask({
      role: "MANAGER",
      actorEmployeeId: "emp_9",
      assignedEmployeeId: "emp_9",
    })
    assert.equal(v.allowed, false)
    assert.match(v.allowed === false ? v.reason : "", /Partner/)
  })

  test("a manager can file someone else's work — that is the review step", () => {
    assert.deepEqual(
      canSignOffTask({
        role: "MANAGER",
        actorEmployeeId: "emp_9",
        assignedEmployeeId: "emp_3",
      }),
      { allowed: true }
    )
  })

  test("a manager with no employee record is not blocked by a null match", () => {
    // A null actorEmployeeId must never be treated as equal to a null assignee,
    // or an unassigned task would become unfileable by anyone but a Partner.
    assert.deepEqual(
      canSignOffTask({
        role: "MANAGER",
        actorEmployeeId: null,
        assignedEmployeeId: null,
      }),
      { allowed: true }
    )
  })

  test("a partner files their own work — there is nobody above them", () => {
    // A single-partner practice would otherwise be unable to file at all.
    assert.deepEqual(
      canSignOffTask({
        role: "PARTNER",
        actorEmployeeId: "emp_1",
        assignedEmployeeId: "emp_1",
      }),
      { allowed: true }
    )
  })

  test("a client cannot file anything", () => {
    const v = canSignOffTask({
      role: "CLIENT",
      actorEmployeeId: null,
      assignedEmployeeId: "emp_1",
    })
    assert.equal(v.allowed, false)
  })
})

describe("invoiceNeedsApproval — a ceiling on what leaves the firm", () => {
  test("a manager over the limit is held", () => {
    assert.equal(
      invoiceNeedsApproval({ role: "MANAGER", totalAmount: 500_000, limit: 100_000 }),
      true
    )
  })

  test("a manager under the limit is not", () => {
    assert.equal(
      invoiceNeedsApproval({ role: "MANAGER", totalAmount: 50_000, limit: 100_000 }),
      false
    )
  })

  test("exactly at the limit is within what a manager may issue", () => {
    // "Approval needed above ₹1,00,000" must not hold an invoice for exactly
    // ₹1,00,000 — an off-by-one here is the kind that gets noticed loudly.
    assert.equal(
      invoiceNeedsApproval({ role: "MANAGER", totalAmount: 100_000, limit: 100_000 }),
      false
    )
  })

  test("a partner is never held — they are the approver", () => {
    assert.equal(
      invoiceNeedsApproval({ role: "PARTNER", totalAmount: 10_000_000, limit: 1_000 }),
      false
    )
  })

  test("no limit set means no gate", () => {
    assert.equal(
      invoiceNeedsApproval({ role: "MANAGER", totalAmount: 9_999_999, limit: null }),
      false
    )
  })

  test("a zero or negative limit is treated as unset, not as gate-everything", () => {
    // A firm that types 0 means "no limit", not "every invoice needs me".
    assert.equal(invoiceNeedsApproval({ role: "MANAGER", totalAmount: 1, limit: 0 }), false)
    assert.equal(invoiceNeedsApproval({ role: "MANAGER", totalAmount: 1, limit: -5 }), false)
  })

  test("a NaN amount does not silently pass the gate", () => {
    assert.equal(
      invoiceNeedsApproval({ role: "MANAGER", totalAmount: Number.NaN, limit: 100 }),
      false
    )
  })
})

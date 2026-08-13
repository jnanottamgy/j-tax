/**
 * What a new client is provisioned with.
 *
 * Onboarding generates the client's services, opening tasks, compliance
 * schedule, reminders and document checklist in one transaction. The tasks in
 * particular used to come out ownerless.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { buildOnboardingArtifacts } from "@/lib/clients/onboarding"

const services = [
  { serviceType: "GST_RETURN" as const, frequency: "MONTHLY" as const },
  { serviceType: "TDS" as const, frequency: "QUARTERLY" as const },
]

describe("buildOnboardingArtifacts — opening tasks have an owner", () => {
  test("tasks go to the employee who owns the client", () => {
    // Two tasks per service, all previously assignedEmployeeId: null — so a
    // four-service client dropped eight items into the "Nobody assigned" queue
    // on day one, work that already had an obvious owner on the client record.
    const out = buildOnboardingArtifacts("cli_1", "Patel Enterprises", services, {
      assignedEmployeeId: "emp_7",
    })

    assert.equal(out.tasks.length, 4)
    for (const t of out.tasks) {
      assert.equal(t.assignedEmployeeId, "emp_7")
    }
  })

  test("assigned tasks wait to be accepted", () => {
    // The assignment handshake is the whole point of the acceptance gate —
    // inheriting work without agreeing to it would skip it.
    const out = buildOnboardingArtifacts("cli_1", "Patel", services, {
      assignedEmployeeId: "emp_7",
    })
    for (const t of out.tasks) {
      assert.equal(t.acceptanceStatus, "PENDING")
    }
  })

  test("unassigned tasks start ACCEPTED, not pending on nobody", () => {
    // A client with no owner yet produces tasks nobody can accept. Leaving them
    // PENDING would park them in a queue waiting on a person who doesn't exist;
    // they belong in "Nobody assigned" instead.
    const out = buildOnboardingArtifacts("cli_1", "Patel", services)
    assert.equal(out.tasks.length, 4)
    for (const t of out.tasks) {
      assert.equal(t.assignedEmployeeId, null)
      assert.equal(t.acceptanceStatus, "ACCEPTED")
    }
  })

  test("an explicit null owner behaves the same as none given", () => {
    const out = buildOnboardingArtifacts("cli_1", "Patel", services, {
      assignedEmployeeId: null,
    })
    assert.equal(out.tasks[0].acceptanceStatus, "ACCEPTED")
  })
})

describe("buildOnboardingArtifacts — the rest of the provisioning", () => {
  test("one service row, schedule and reminder per service", () => {
    const out = buildOnboardingArtifacts("cli_1", "Patel", services, {
      assignedEmployeeId: "emp_7",
    })
    assert.equal(out.services.length, 2)
    assert.equal(out.complianceSchedules.length, 2)
    assert.equal(out.reminders.length, 2)
  })

  test("the agreed fee lands on the engagement, not on the task", () => {
    const out = buildOnboardingArtifacts(
      "cli_1",
      "Patel",
      [{ serviceType: "AUDIT" as const, frequency: "ANNUAL" as const, agreedFee: 75000 }],
      { assignedEmployeeId: "emp_7" }
    )
    assert.equal(out.services[0].agreedFee, 75000)
    assert.ok(out.services[0].feeAgreedAt instanceof Date)
  })

  test("no fee agreed stays null rather than becoming zero", () => {
    // Zero is a real agreed fee. Absent is "not agreed yet". The revenue report
    // counts one and flags the other.
    const out = buildOnboardingArtifacts("cli_1", "Patel", services)
    assert.equal(out.services[0].agreedFee, null)
    assert.equal(out.services[0].feeAgreedAt, null)
  })
})

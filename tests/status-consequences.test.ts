/**
 * Status chips carried a colour and a label and nothing else, and the rules
 * behind them are not guessable — UNDER_REVIEW silently stops the overdue
 * alert, WAIVED silently leaves the client's outstanding balance.
 *
 * The maps that state those consequences are hand-written, which means they go
 * stale the moment somebody adds a status to the schema. These tests read the
 * schema and fail when a status has no stated consequence, so the next person
 * to add one is told to say what it does.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  COMPLIANCE_STATUS_MEANING,
  INVOICE_STATUS_MEANING,
  TASK_STATUS_MEANING,
  statusMeaning,
} from "@/lib/status/consequences"

const SCHEMA = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8")

/** Values of a Prisma enum, straight from the schema file. */
function enumValues(name: string): string[] {
  const m = SCHEMA.match(new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`))
  assert.ok(m, `enum ${name} not found in schema.prisma`)
  return m![1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => l.length > 0 && /^[A-Z_]+$/.test(l))
}

describe("every status states what it does", () => {
  test("TaskStatus is fully covered", () => {
    const values = enumValues("TaskStatus")
    assert.ok(values.length > 0)
    for (const v of values) {
      assert.ok(
        statusMeaning(TASK_STATUS_MEANING, v),
        `TaskStatus.${v} has no stated consequence — add one to TASK_STATUS_MEANING`
      )
    }
  })

  test("InvoiceStatus is fully covered", () => {
    for (const v of enumValues("InvoiceStatus")) {
      assert.ok(
        statusMeaning(INVOICE_STATUS_MEANING, v),
        `InvoiceStatus.${v} has no stated consequence — add one to INVOICE_STATUS_MEANING`
      )
    }
  })

  test("ComplianceEventStatus is fully covered", () => {
    for (const v of enumValues("ComplianceEventStatus")) {
      assert.ok(
        statusMeaning(COMPLIANCE_STATUS_MEANING, v),
        `ComplianceEventStatus.${v} has no stated consequence — add one to COMPLIANCE_STATUS_MEANING`
      )
    }
  })

  test("the maps invent no statuses the schema does not have", () => {
    // A stale entry is quieter than a missing one but just as wrong: it puts a
    // tooltip on a status that no longer exists, or misspells a real one.
    const task = new Set(enumValues("TaskStatus"))
    for (const k of Object.keys(TASK_STATUS_MEANING)) {
      assert.ok(task.has(k), `TASK_STATUS_MEANING has ${k}, which is not a TaskStatus`)
    }
    const invoice = new Set(enumValues("InvoiceStatus"))
    for (const k of Object.keys(INVOICE_STATUS_MEANING)) {
      assert.ok(invoice.has(k), `INVOICE_STATUS_MEANING has ${k}, which is not an InvoiceStatus`)
    }
  })
})

describe("the statuses that go quiet are marked", () => {
  test("a task under review or on hold raises no overdue alert", () => {
    // Pinned against app/api/cron/reminders/route.ts, which alerts only on
    // NOT_STARTED, IN_PROGRESS and DATA_AWAITED. If that query grows a status,
    // this test should fail and the map should change with it.
    assert.equal(TASK_STATUS_MEANING.UNDER_REVIEW.automated, false)
    assert.equal(TASK_STATUS_MEANING.ON_HOLD.automated, false)
    assert.equal(TASK_STATUS_MEANING.DATA_AWAITED.automated, true)
    assert.equal(TASK_STATUS_MEANING.IN_PROGRESS.automated, true)
  })

  test("waived and disputed invoices are not chased", () => {
    assert.equal(INVOICE_STATUS_MEANING.WAIVED.automated, false)
    assert.equal(INVOICE_STATUS_MEANING.DISPUTED.automated, false)
    assert.equal(INVOICE_STATUS_MEANING.SENT.automated, true)
  })

  test("a waived invoice says the money is gone, not deferred", () => {
    assert.match(INVOICE_STATUS_MEANING.WAIVED.consequence, /outstanding balance/)
  })

  test("statusMeaning tolerates a status it does not know", () => {
    assert.equal(statusMeaning(TASK_STATUS_MEANING, "NONSENSE"), null)
  })
})

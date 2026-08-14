/**
 * Due-date windows — the axis every list was missing.
 *
 * Lists filtered by status, which describes how work is progressing, not when
 * it is due. A task can be IN_PROGRESS and three weeks late and no status
 * filter will ever surface that.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  DUE_WINDOW_OPTIONS,
  dueWindowPrismaFilter,
  dueWindowRange,
  matchesDueWindow,
} from "@/lib/filters/due-window"

// A fixed "now" — mid-morning, so the boundary cases are meaningful.
const NOW = new Date(2026, 7, 14, 10, 30) // 14 Aug 2026, 10:30

describe("dueWindowRange", () => {
  test("OVERDUE stops at the start of today, not at this instant", () => {
    // Something due at 5pm today is not late at 10:30am. Calling it late is how
    // a list cries wolf until people stop reading it.
    const r = dueWindowRange("OVERDUE", NOW)
    assert.ok(r.to)
    assert.equal(r.to!.getDate(), 13)
    assert.equal(r.from, undefined)
  })

  test("forward windows start at the beginning of today", () => {
    // A task due at 9am today is still due; hiding it at 10:30 would be a
    // strange kind of tidiness.
    const r = dueWindowRange("THIS_WEEK", NOW)
    assert.equal(r.from?.getHours(), 0)
    assert.equal(r.from?.getDate(), 14)
  })

  test("NO_DATE is not a range", () => {
    assert.deepEqual(dueWindowRange("NO_DATE", NOW), { missing: true })
  })

  test("every option has a range", () => {
    for (const opt of DUE_WINDOW_OPTIONS) {
      assert.ok(dueWindowRange(opt.value, NOW), `${opt.value} has no range`)
    }
  })
})

describe("matchesDueWindow", () => {
  test("something due earlier today is not overdue", () => {
    assert.equal(matchesDueWindow(new Date(2026, 7, 14, 9, 0), "OVERDUE", NOW), false)
  })

  test("yesterday is overdue", () => {
    assert.equal(matchesDueWindow(new Date(2026, 7, 13, 23, 0), "OVERDUE", NOW), true)
  })

  test("due today counts as due today and as due in 7 days", () => {
    const d = new Date(2026, 7, 14, 17, 0)
    assert.equal(matchesDueWindow(d, "TODAY", NOW), true)
    assert.equal(matchesDueWindow(d, "THIS_WEEK", NOW), true)
  })

  test("day 8 falls outside the 7-day window but inside 30", () => {
    const d = new Date(2026, 7, 22, 12, 0)
    assert.equal(matchesDueWindow(d, "THIS_WEEK", NOW), false)
    assert.equal(matchesDueWindow(d, "NEXT_30", NOW), true)
  })

  test("a null due date matches only NO_DATE", () => {
    // Worth being able to find: nothing chases a task with no due date.
    assert.equal(matchesDueWindow(null, "NO_DATE", NOW), true)
    assert.equal(matchesDueWindow(null, "OVERDUE", NOW), false)
    assert.equal(matchesDueWindow(null, "THIS_WEEK", NOW), false)
  })

  test("a dated row never matches NO_DATE", () => {
    assert.equal(matchesDueWindow(new Date(2026, 7, 1), "NO_DATE", NOW), false)
  })

  test("an unparseable date matches nothing rather than throwing", () => {
    assert.equal(matchesDueWindow("not a date", "OVERDUE", NOW), false)
  })

  test("ISO strings work, since that is what crosses the wire", () => {
    assert.equal(matchesDueWindow("2026-08-13T10:00:00.000Z", "OVERDUE", NOW), true)
  })
})

describe("dueWindowPrismaFilter", () => {
  test("returns null for NO_DATE so the caller writes `dueDate: null`", () => {
    // "is null" is not a range, and returning an empty range would silently
    // match everything — the exact opposite of what was asked for.
    assert.equal(dueWindowPrismaFilter("NO_DATE", NOW), null)
  })

  test("OVERDUE is an upper bound only", () => {
    const f = dueWindowPrismaFilter("OVERDUE", NOW)
    assert.ok(f && f.lte instanceof Date)
    assert.equal(f?.gte, undefined)
  })

  test("bounded windows carry both ends", () => {
    const f = dueWindowPrismaFilter("NEXT_30", NOW)
    assert.ok(f?.gte instanceof Date)
    assert.ok(f?.lte instanceof Date)
    assert.ok(f!.gte! < f!.lte!)
  })
})

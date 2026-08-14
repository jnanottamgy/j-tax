/**
 * Presence and attendance rules.
 *
 * The old system measured hours as logoutAt − loginAt and only wrote them when
 * somebody explicitly signed out. Nobody signs out, so most days recorded zero
 * while a forgotten tab read as seventy-two hours. These pin the arithmetic
 * that replaced it.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  IDLE_AFTER_MINUTES,
  MAX_CREDIT_PER_BEAT_MINUTES,
  STALE_AFTER_MINUTES,
  closingTimeFor,
  creditForBeat,
  isStale,
  liveSessionMinutes,
  presenceStatus,
  utilisation,
} from "@/lib/workforce/presence"
import {
  DEFAULT_RULES,
  isLateArrival,
  isWorkingDay,
  localMinutesOfDay,
  localWeekday,
  parseClockTime,
} from "@/lib/workforce/attendance-rules"

const at = (min: number) => new Date(2026, 2, 2, 9, 0, 0)
const plus = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60_000)
const NINE = new Date(2026, 2, 2, 9, 0, 0)

describe("creditForBeat", () => {
  test("a normal beat credits the interval", () => {
    assert.equal(creditForBeat(NINE, plus(NINE, 5)), 5)
  })

  test("a long silence credits at most one interval, not the whole gap", () => {
    // The case that decides whether a laptop waking at 9am bills the night.
    assert.equal(creditForBeat(NINE, plus(NINE, 600)), MAX_CREDIT_PER_BEAT_MINUTES)
  })

  test("beats arriving faster than they should cannot double-count", () => {
    // Two windows open would otherwise credit twice the real time.
    assert.equal(creditForBeat(NINE, plus(NINE, 1)), 1)
    assert.equal(creditForBeat(NINE, NINE), 0)
  })

  test("clock skew never credits negative time", () => {
    assert.equal(creditForBeat(plus(NINE, 5), NINE), 0)
  })
})

describe("isStale / closingTimeFor", () => {
  test("silence past the threshold is stale", () => {
    assert.equal(isStale(NINE, plus(NINE, STALE_AFTER_MINUTES + 1)), true)
    assert.equal(isStale(NINE, plus(NINE, STALE_AFTER_MINUTES - 1)), false)
  })

  test("a session closes at its last beat, not at the sweep", () => {
    // A sweep running at midnight must not stamp midnight on a session that
    // went quiet at six. That is what made the old logoutAt values untrue.
    const closed = closingTimeFor(NINE)
    assert.equal(closed.getTime(), NINE.getTime())
  })
})

describe("presenceStatus", () => {
  test("a recent beat is online", () => {
    assert.equal(presenceStatus(NINE, plus(NINE, 2)), "ONLINE")
  })

  test("quiet but not gone is idle", () => {
    assert.equal(presenceStatus(NINE, plus(NINE, IDLE_AFTER_MINUTES + 1)), "IDLE")
  })

  test("quiet past the stale threshold is offline, not idle for ever", () => {
    // The old dashboard showed a forgotten tab as IDLE indefinitely.
    assert.equal(presenceStatus(NINE, plus(NINE, STALE_AFTER_MINUTES + 1)), "OFFLINE")
  })

  test("no session at all is offline", () => {
    assert.equal(presenceStatus(null, NINE), "OFFLINE")
  })
})

describe("liveSessionMinutes", () => {
  test("an open session shows accumulated time plus the current stretch", () => {
    const mins = liveSessionMinutes({ activeMinutes: 120, lastActiveAt: NINE }, plus(NINE, 3))
    assert.equal(mins, 123)
  })

  test("a session abandoned days ago cannot report days of work", () => {
    // The exact failure: `now - loginAt` reported 72 hours for a tab left open
    // on Friday. Accumulated beats stop when the beats stop.
    const mins = liveSessionMinutes({ activeMinutes: 400, lastActiveAt: NINE }, plus(NINE, 4320))
    assert.equal(mins, 400 + MAX_CREDIT_PER_BEAT_MINUTES)
  })
})

describe("utilisation", () => {
  test("booked time as a share of time present", () => {
    assert.equal(utilisation({ presentMinutes: 480, bookedMinutes: 240 }), 50)
  })

  test("nobody present is null, not zero", () => {
    // Zero would read as a failure to book time rather than as a day off.
    assert.equal(utilisation({ presentMinutes: 0, bookedMinutes: 0 }), null)
  })

  test("booking more than you were online is allowed", () => {
    // Work done offline and entered later is real and must not be clamped.
    assert.equal(utilisation({ presentMinutes: 60, bookedMinutes: 120 }), 200)
  })
})

describe("attendance rules", () => {
  test("parses a clock time and falls back on nonsense", () => {
    assert.equal(parseClockTime("10:00", 0), 600)
    assert.equal(parseClockTime("25:00", 570), 570)
    assert.equal(parseClockTime(null, 570), 570)
  })

  test("local time is the firm's, not the server's", () => {
    // 04:00 UTC is 09:30 IST.
    const utc4 = new Date(Date.UTC(2026, 2, 2, 4, 0))
    assert.equal(localMinutesOfDay(utc4, 330), 9 * 60 + 30)
  })

  test("weekday is computed in the firm's local time", () => {
    // 20:00 UTC Sunday is already Monday in IST.
    const sundayNight = new Date(Date.UTC(2026, 2, 1, 20, 0))
    assert.equal(localWeekday(sundayNight, 330), 1)
  })

  test("Saturday is a working day by default, Sunday is not", () => {
    // Six-day weeks are the norm in Indian practice.
    const sat = new Date(Date.UTC(2026, 2, 7, 5, 0))
    const sun = new Date(Date.UTC(2026, 2, 8, 5, 0))
    assert.equal(isWorkingDay(sat, DEFAULT_RULES), true)
    assert.equal(isWorkingDay(sun, DEFAULT_RULES), false)
  })

  test("the grace period is real", () => {
    // 09:40 IST with a 15-minute grace is on time; the old rule called
    // anything after 09:30 late.
    const at0940 = new Date(Date.UTC(2026, 2, 2, 4, 10))
    assert.equal(isLateArrival(at0940, DEFAULT_RULES), false)
  })

  test("past the grace period is late", () => {
    const at1000 = new Date(Date.UTC(2026, 2, 2, 4, 30))
    assert.equal(isLateArrival(at1000, DEFAULT_RULES), true)
  })

  test("a firm that starts at 10:00 does not mark its whole team late", () => {
    // The reason this is configurable at all.
    const at1000 = new Date(Date.UTC(2026, 2, 2, 4, 30))
    assert.equal(isLateArrival(at1000, { ...DEFAULT_RULES, startMinutes: 600 }), false)
  })

  test("nobody is late on a day the firm does not work", () => {
    const sundayMidday = new Date(Date.UTC(2026, 2, 8, 8, 0))
    assert.equal(isLateArrival(sundayMidday, DEFAULT_RULES), false)
  })
})

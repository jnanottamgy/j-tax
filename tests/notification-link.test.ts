/**
 * Where a notification points.
 *
 * entityType and entityId were written on every notification from the start and
 * the bell read neither, so every alert dead-ended on the notifications list.
 * These pin the destinations — and pin that an unknowable one returns null
 * rather than a link to the wrong screen.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { notificationHref } from "@/lib/notifications/entity-link"

describe("notificationHref — deep links", () => {
  test("a task opens its own drawer, not the list", () => {
    // The whole point: "Task assigned: GSTR-3B for Patel Enterprises" used to
    // be followed by opening Work Tracker and searching for the row by hand.
    assert.equal(
      notificationHref("TASK", "tsk_123"),
      "/work-tracker?taskId=tsk_123"
    )
  })

  test("an invoice opens its detail page", () => {
    assert.equal(notificationHref("INVOICE", "inv_9"), "/payments/invoices/inv_9")
  })

  test("a client opens Client 360", () => {
    assert.equal(notificationHref("CLIENT", "cli_4"), "/clients/cli_4")
  })

  test("a compliance event opens the event", () => {
    assert.equal(notificationHref("COMPLIANCE", "evt_2"), "/compliance?eventId=evt_2")
  })
})

describe("notificationHref — degrading honestly", () => {
  test("a missing id falls back to the list, not a broken URL", () => {
    assert.equal(notificationHref("TASK", null), "/work-tracker")
    assert.equal(notificationHref("INVOICE", ""), "/payments/invoices")
    assert.equal(notificationHref("CLIENT", "   "), "/clients")
  })

  test("a payment routes to the payments screen, not a per-payment page", () => {
    // entityId here is the payment's own id, and there is no screen keyed on it.
    assert.equal(notificationHref("PAYMENT", "pay_1"), "/payments")
  })

  test("an unknown entity type yields null rather than a guess", () => {
    // Null means "use the notifications list". A link that lands on the wrong
    // screen is worse than no link.
    assert.equal(notificationHref(null, "x"), null)
    assert.equal(notificationHref(undefined, "x"), null)
  })

  test("ids are URL-encoded", () => {
    assert.equal(
      notificationHref("TASK", "a b/c"),
      "/work-tracker?taskId=a%20b%2Fc"
    )
  })
})

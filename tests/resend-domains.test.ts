/**
 * Tests for normalising the DNS records Resend returns.
 *
 * These matter more than they look. Resend returns record names RELATIVE to
 * the domain ("send", "resend._domainkey") and quotes TXT values. If we render
 * those verbatim, the firm pastes a wrong host into their DNS panel, the
 * record never validates, and the domain sits at "pending" forever with no
 * indication why — which is exactly the failure mode this whole module
 * replaced.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { normaliseRecords } from "@/lib/messaging/resend-domains"

const DOMAIN = "acmeca.com"

describe("normaliseRecords", () => {
  test("expands a relative host to a fully-qualified one", () => {
    const [rec] = normaliseRecords(
      [{ record: "DKIM", name: "resend._domainkey", type: "TXT", value: "p=MIGfMA0G" }],
      DOMAIN
    )
    assert.equal(rec.host, "resend._domainkey.acmeca.com")
  })

  test("leaves an already-qualified host alone (no doubled domain)", () => {
    const [rec] = normaliseRecords(
      [{ record: "SPF", name: "send.acmeca.com", type: "TXT", value: "v=spf1 include:amazonses.com ~all" }],
      DOMAIN
    )
    assert.equal(rec.host, "send.acmeca.com")
  })

  test("maps an apex record ('@' or empty) to the bare domain", () => {
    const [at] = normaliseRecords([{ name: "@", type: "TXT", value: "v=spf1 ~all" }], DOMAIN)
    const [empty] = normaliseRecords([{ name: "", type: "TXT", value: "v=spf1 ~all" }], DOMAIN)
    assert.equal(at.host, DOMAIN)
    assert.equal(empty.host, DOMAIN)
  })

  test("strips the quotes Resend wraps TXT values in", () => {
    const [rec] = normaliseRecords(
      [{ record: "SPF", name: "send", type: "TXT", value: '"v=spf1 include:amazonses.com ~all"' }],
      DOMAIN
    )
    assert.equal(rec.value, "v=spf1 include:amazonses.com ~all")
  })

  test("preserves MX priority", () => {
    const [rec] = normaliseRecords(
      [
        {
          record: "SPF",
          name: "send",
          type: "MX",
          value: "feedback-smtp.us-east-1.amazonses.com",
          priority: 10,
        },
      ],
      DOMAIN
    )
    assert.equal(rec.type, "MX")
    assert.equal(rec.priority, 10)
  })

  test("carries per-record provider status through", () => {
    const [rec] = normaliseRecords(
      [{ record: "DKIM", name: "resend._domainkey", type: "TXT", value: "p=x", status: "verified" }],
      DOMAIN
    )
    assert.equal(rec.status, "verified")
  })

  test("omits priority when absent rather than emitting undefined/NaN", () => {
    const [rec] = normaliseRecords(
      [{ record: "DKIM", name: "resend._domainkey", type: "TXT", value: "p=x" }],
      DOMAIN
    )
    assert.equal("priority" in rec, false)
  })

  test("tolerates a malformed payload instead of throwing", () => {
    // A provider shape change must degrade to "no records", not crash the
    // Settings page for every firm.
    assert.deepEqual(normaliseRecords(null, DOMAIN), [])
    assert.deepEqual(normaliseRecords(undefined, DOMAIN), [])
    assert.deepEqual(normaliseRecords({ nope: true }, DOMAIN), [])
  })
})

/**
 * Compose-URL hand-off.
 *
 * Sending through the provider needs a verified domain; until that exists the
 * quotation is marked Sent, the email history says FAILED, and the client is
 * still waiting. These links are the way out of that, so they have to open a
 * usable draft every time — including when the body is long enough that Gmail
 * would otherwise drop the URL on the floor.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  buildGmailComposeUrl,
  buildMailtoUrl,
  draftQuotationEmail,
} from "@/lib/messaging/email-link"

const draft = {
  to: "client@example.com",
  subject: "Quotation QT-00003",
  body: "Dear Sushant,\n\nPlease find our quotation.",
}

describe("buildGmailComposeUrl", () => {
  test("opens a compose window addressed to the client", () => {
    const url = buildGmailComposeUrl(draft)!
    const parsed = new URL(url)
    assert.equal(parsed.host, "mail.google.com")
    assert.equal(parsed.searchParams.get("view"), "cm")
    assert.equal(parsed.searchParams.get("to"), "client@example.com")
    assert.equal(parsed.searchParams.get("su"), "Quotation QT-00003")
  })

  test("keeps line breaks in the body", () => {
    const url = buildGmailComposeUrl(draft)!
    assert.match(new URL(url).searchParams.get("body")!, /Dear Sushant,\n\nPlease/)
  })

  test("no recipient means no link, rather than an empty compose window", () => {
    assert.equal(buildGmailComposeUrl({ ...draft, to: "" }), null)
    assert.equal(buildGmailComposeUrl({ ...draft, to: "   " }), null)
  })

  test("a very long body is trimmed instead of producing a URL Gmail drops", () => {
    const url = buildGmailComposeUrl({ ...draft, body: "x".repeat(20000) })!
    assert.ok(url.length <= 1900, `url was ${url.length} chars`)
    // The parts that make the draft usable must survive the trim.
    const parsed = new URL(url)
    assert.equal(parsed.searchParams.get("to"), "client@example.com")
    assert.equal(parsed.searchParams.get("su"), "Quotation QT-00003")
  })

  test("a body of multi-byte characters is also trimmed to fit", () => {
    // Each of these encodes to several bytes, so a naive character count would
    // still overshoot the limit.
    const url = buildGmailComposeUrl({ ...draft, body: "₹".repeat(5000) })!
    assert.ok(url.length <= 1900, `url was ${url.length} chars`)
  })
})

describe("buildMailtoUrl", () => {
  test("addresses the recipient and carries the subject", () => {
    const url = buildMailtoUrl(draft)!
    assert.ok(url.startsWith("mailto:client%40example.com?"))
    assert.match(url, /subject=Quotation\+QT-00003/)
  })

  test("no recipient means no link", () => {
    assert.equal(buildMailtoUrl({ ...draft, to: "" }), null)
  })
})

describe("draftQuotationEmail", () => {
  const input = {
    clientName: "Sushant",
    quotationNumber: "QT-00003",
    firmName: "TaxWise Consultants",
    senderName: "CA Vinay H Karlagere",
    publicUrl: "https://example.com/q/abc123",
    total: 45000,
    validUntil: new Date(2026, 8, 26),
  }

  test("carries the link the client actually acts on", () => {
    // The link is the point: it shows the live quotation and lets them accept
    // or decline. A PDF cannot be attached to a compose URL and could not do
    // either of those things if it were.
    assert.match(draftQuotationEmail(input).body, /https:\/\/example\.com\/q\/abc123/)
  })

  test("states the amount and the expiry, so the client need not open it to know", () => {
    const { body } = draftQuotationEmail(input)
    assert.match(body, /45,000\.00/)
    // en-IN abbreviates September as "Sept", not "Sep".
    assert.match(body, /26 Sept 2026/)
  })

  test("names the firm in the subject", () => {
    assert.match(draftQuotationEmail(input).subject, /QT-00003 from TaxWise Consultants/)
  })

  test("omits the amount and expiry lines rather than printing blanks", () => {
    const { body } = draftQuotationEmail({ ...input, total: null, validUntil: null })
    assert.doesNotMatch(body, /Total:/)
    assert.doesNotMatch(body, /Valid until:/)
    assert.match(body, /Dear Sushant,/)
  })
})

describe("draftQuotationEmail sign-off", () => {
  const base = {
    clientName: "Sushant",
    quotationNumber: "QT-00003",
    firmName: "TaxWise Consultants",
    publicUrl: "https://example.com/q/abc",
  }

  test("does not print the firm name twice when there is no separate sender", () => {
    const body = draftQuotationEmail(base).body
    assert.equal(body.match(/TaxWise Consultants/g)?.length, 1)
  })

  test("names the sender above the firm when they differ", () => {
    const body = draftQuotationEmail({ ...base, senderName: "CA Vinay H Karlagere" }).body
    assert.match(body, /Regards,\nCA Vinay H Karlagere\nTaxWise Consultants/)
  })
})

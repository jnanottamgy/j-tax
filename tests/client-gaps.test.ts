/**
 * Two gaps in a client record that cost real money, and the rules that make
 * them visible.
 *
 * Both were silent by construction: a client with no email address was skipped
 * by every automated send, and a client with no GSTIN was invoiced anyway. In
 * each case the code did the safe thing and told nobody.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  clientReachability,
  reachabilityBadgeLabel,
} from "@/lib/clients/reachability"
import {
  GST_UNREGISTERED,
  invoiceGstinWarning,
  placeOfSupplyIsAssumed,
  resolveGstRegistration,
} from "@/lib/clients/gst-registration"

describe("clientReachability", () => {
  test("a complete record raises nothing", () => {
    const r = clientReachability({
      email: "a@b.com",
      phone: "9876543210",
      whatsapp: null,
    })
    assert.equal(r.canEmail, true)
    assert.equal(r.isReachable, true)
    assert.equal(r.gap, null)
    assert.deepEqual(r.missing, [])
    assert.equal(reachabilityBadgeLabel(r), null)
  })

  test("no email means no automated anything, even with a phone number", () => {
    // The whole failure: a phone number looks like contact details, but nothing
    // in the app dials it. WhatsApp only ever goes out as a copy of an email.
    const r = clientReachability({ email: null, phone: "9876543210", whatsapp: null })
    assert.equal(r.canEmail, false)
    assert.equal(r.canCall, true)
    assert.equal(r.isReachable, true)
    assert.match(r.gap ?? "", /reminders/)
    assert.equal(reachabilityBadgeLabel(r), "No email")
  })

  test("whitespace is not an email address", () => {
    const r = clientReachability({ email: "   ", phone: null, whatsapp: null })
    assert.equal(r.canEmail, false)
    assert.equal(r.isReachable, false)
  })

  test("a WhatsApp number counts as callable when phone is blank", () => {
    const r = clientReachability({ email: "a@b.com", phone: null, whatsapp: "9876543210" })
    assert.equal(r.canCall, true)
    assert.equal(r.canWhatsApp, true)
    assert.equal(r.gap, null)
  })

  test("nothing at all is its own, louder case", () => {
    const r = clientReachability({ email: null, phone: null, whatsapp: null })
    assert.equal(r.isReachable, false)
    assert.deepEqual(r.missing, ["email", "phone"])
    assert.match(r.gap ?? "", /cannot be contacted at all/)
    assert.equal(reachabilityBadgeLabel(r), "No contact details")
  })
})

describe("resolveGstRegistration", () => {
  test("a GSTIN settles it", () => {
    const r = resolveGstRegistration({ gstin: "22AAAAA0000A1Z5", gstRegistration: null })
    assert.equal(r.status, "REGISTERED")
  })

  test("blank GSTIN with no answer recorded is UNKNOWN, not unregistered", () => {
    // The distinction this type exists for. Treating unknown as unregistered is
    // exactly the bug: it makes a missing GSTIN look like a deliberate B2C sale.
    const r = resolveGstRegistration({ gstin: null, gstRegistration: null })
    assert.equal(r.status, "UNKNOWN")
  })

  test("an explicit answer is honoured", () => {
    const r = resolveGstRegistration({ gstin: null, gstRegistration: GST_UNREGISTERED })
    assert.equal(r.status, "UNREGISTERED")
  })

  test("an empty-string GSTIN is not a GSTIN", () => {
    assert.equal(resolveGstRegistration({ gstin: "  " }).status, "UNKNOWN")
  })
})

describe("invoiceGstinWarning", () => {
  test("warns when GST is charged to a client whose GSTIN nobody recorded", () => {
    const w = invoiceGstinWarning({ gstin: null, gstRegistration: null, taxAmount: 9000 })
    assert.ok(w)
    assert.match(w.consequence, /input credit/)
  })

  test("stays quiet for a client confirmed unregistered", () => {
    // A genuine B2C invoice is correct with no recipient GSTIN. Warning here
    // would train people to ignore the warning that matters.
    assert.equal(
      invoiceGstinWarning({ gstin: null, gstRegistration: GST_UNREGISTERED, taxAmount: 9000 }),
      null
    )
  })

  test("stays quiet when the GSTIN is known", () => {
    assert.equal(
      invoiceGstinWarning({ gstin: "22AAAAA0000A1Z5", taxAmount: 9000 }),
      null
    )
  })

  test("stays quiet when no GST is being charged", () => {
    // With no tax on the invoice there is no credit to lose, so the recipient
    // GSTIN changes nothing.
    assert.equal(invoiceGstinWarning({ gstin: null, gstRegistration: null, taxAmount: 0 }), null)
  })
})

describe("placeOfSupplyIsAssumed", () => {
  test("true only when neither a state code nor a GSTIN is on record", () => {
    // This is the case where the form fills in the firm's own state, quietly
    // taxing the invoice as intra-state CGST + SGST.
    assert.equal(placeOfSupplyIsAssumed({ gstin: null, stateCode: null }), true)
  })

  test("false once the client's state is known either way", () => {
    assert.equal(placeOfSupplyIsAssumed({ gstin: null, stateCode: "27" }), false)
    assert.equal(placeOfSupplyIsAssumed({ gstin: "22AAAAA0000A1Z5", stateCode: null }), false)
  })

  test("blank strings do not count as known", () => {
    assert.equal(placeOfSupplyIsAssumed({ gstin: "", stateCode: "  " }), true)
  })
})

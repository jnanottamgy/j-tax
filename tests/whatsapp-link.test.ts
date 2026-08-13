/**
 * WhatsApp click-to-chat link tests.
 *
 * Number normalisation is the whole risk surface here. Numbers are typed by
 * humans across onboarding, CSV import and edit forms, so they arrive in every
 * shape imaginable. A wrong result does not error — it silently opens a chat
 * with a stranger, or a dead one. Hence a case per real-world format.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  normalizeWhatsAppNumber,
  buildWhatsAppUrl,
  canWhatsApp,
  resolveWhatsAppNumber,
  formatWhatsAppNumber,
} from "@/lib/messaging/whatsapp-link"

describe("normalizeWhatsAppNumber — Indian formats", () => {
  const expected = "919876543210"

  test("bare 10-digit mobile gains the country code", () => {
    assert.equal(normalizeWhatsAppNumber("9876543210"), expected)
  })
  test("spaced and dashed forms", () => {
    assert.equal(normalizeWhatsAppNumber("98765 43210"), expected)
    assert.equal(normalizeWhatsAppNumber("98765-43210"), expected)
  })
  test("leading 0 trunk prefix is dropped, not treated as a digit", () => {
    assert.equal(normalizeWhatsAppNumber("09876543210"), expected)
  })
  test("+91 in various spacings", () => {
    assert.equal(normalizeWhatsAppNumber("+919876543210"), expected)
    assert.equal(normalizeWhatsAppNumber("+91 98765 43210"), expected)
    assert.equal(normalizeWhatsAppNumber("(+91) 98765-43210"), expected)
  })
  test("91 prefix without a plus", () => {
    assert.equal(normalizeWhatsAppNumber("919876543210"), expected)
  })
  test("00 international access prefix", () => {
    assert.equal(normalizeWhatsAppNumber("00919876543210"), expected)
  })
  test("surrounding whitespace", () => {
    assert.equal(normalizeWhatsAppNumber("  9876543210  "), expected)
  })
})

describe("normalizeWhatsAppNumber — rejects what cannot be messaged", () => {
  test("empty and nullish", () => {
    assert.equal(normalizeWhatsAppNumber(null), null)
    assert.equal(normalizeWhatsAppNumber(undefined), null)
    assert.equal(normalizeWhatsAppNumber(""), null)
    assert.equal(normalizeWhatsAppNumber("   "), null)
  })
  test("no digits at all", () => {
    assert.equal(normalizeWhatsAppNumber("not a number"), null)
    assert.equal(normalizeWhatsAppNumber("-"), null)
  })
  test("too short to be a real subscriber number", () => {
    assert.equal(normalizeWhatsAppNumber("12345"), null)
  })
  test("beyond the E.164 15-digit ceiling", () => {
    assert.equal(normalizeWhatsAppNumber("+1234567890123456"), null)
  })
  test("Indian landlines are not on WhatsApp — 10 digits not starting 6-9", () => {
    assert.equal(normalizeWhatsAppNumber("2212345678"), null)
    assert.equal(normalizeWhatsAppNumber("+912212345678"), null)
  })
})

describe("normalizeWhatsAppNumber — other countries", () => {
  test("an explicit country code is never overwritten with 91", () => {
    // UK mobile — 10 digits after the code, but the + means it is complete.
    assert.equal(normalizeWhatsAppNumber("+447911123456"), "447911123456")
    // US
    assert.equal(normalizeWhatsAppNumber("+1 415 555 2671"), "14155552671")
  })
  test("default country code is configurable", () => {
    assert.equal(normalizeWhatsAppNumber("4155552671", "1"), "14155552671")
  })
})

describe("buildWhatsAppUrl", () => {
  test("uses wa.me so the link resolves on both phone and desktop", () => {
    assert.equal(buildWhatsAppUrl("9876543210"), "https://wa.me/919876543210")
  })
  test("appends an encoded message", () => {
    const url = buildWhatsAppUrl("9876543210", "Hello Ravi")
    assert.equal(url, "https://wa.me/919876543210?text=Hello%20Ravi")
  })
  test("preserves newlines as %0A so drafts keep their line breaks", () => {
    const url = buildWhatsAppUrl("9876543210", "Line one\nLine two")!
    assert.ok(url.includes("%0A"), `expected encoded newline in ${url}`)
  })
  test("encodes characters that would otherwise break the query string", () => {
    const url = buildWhatsAppUrl("9876543210", "Invoice #INV-1 & ₹1,000 due?")!
    assert.ok(!url.includes("#"), "unescaped # would truncate the message")
    assert.ok(!url.slice(url.indexOf("?text=") + 6).includes("&"), "unescaped & would split params")
  })
  test("omits the text param when there is no message", () => {
    assert.equal(buildWhatsAppUrl("9876543210", "   "), "https://wa.me/919876543210")
  })
  test("returns null for an unusable number rather than a broken link", () => {
    assert.equal(buildWhatsAppUrl("", "hi"), null)
    assert.equal(buildWhatsAppUrl("2212345678", "hi"), null)
  })
})

describe("resolveWhatsAppNumber", () => {
  test("prefers the dedicated whatsapp field", () => {
    assert.equal(
      resolveWhatsAppNumber({ whatsapp: "9876543210", phone: "9123456789" }),
      "919876543210"
    )
  })
  test("falls back to phone when whatsapp is blank or unusable", () => {
    assert.equal(resolveWhatsAppNumber({ whatsapp: "", phone: "9123456789" }), "919123456789")
    assert.equal(
      resolveWhatsAppNumber({ whatsapp: "2212345678", phone: "9123456789" }),
      "919123456789"
    )
  })
  test("null when the contact has nothing messageable", () => {
    assert.equal(resolveWhatsAppNumber({ whatsapp: null, phone: null }), null)
  })
})

describe("helpers", () => {
  test("canWhatsApp mirrors normalisation", () => {
    assert.equal(canWhatsApp("9876543210"), true)
    assert.equal(canWhatsApp("2212345678"), false)
  })
  test("formatWhatsAppNumber renders Indian numbers readably", () => {
    assert.equal(formatWhatsAppNumber("9876543210"), "+91 98765 43210")
    assert.equal(formatWhatsAppNumber("+447911123456"), "+447911123456")
    assert.equal(formatWhatsAppNumber("junk"), null)
  })
})

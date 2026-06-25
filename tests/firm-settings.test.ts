/**
 * Unit tests for the firm-branded email identity logic.
 * Pure functions — no DB access. Run with: npm test
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  extractDomain,
  resolveSenderEnvelope,
  buildDnsInstructions,
  getPlatformFallbackFrom,
  type FirmConfig,
} from "@/lib/firm-settings"

function makeConfig(overrides: Partial<FirmConfig> = {}): FirmConfig {
  return {
    firmName: "Tax Wise Consultants",
    fromEmail: "office@taxwiseconsultants.com",
    replyToEmail: "office@taxwiseconsultants.com",
    firmPhone: null,
    firmAddress: null,
    gstin: null,
    pan: null,
    website: null,
    firmDomain: "taxwiseconsultants.com",
    domainVerified: false,
    domainVerifiedAt: null,
    verificationToken: "jtacs-verify=abc123",
    platformFallbackEnabled: true,
    ...overrides,
  }
}

describe("extractDomain", () => {
  test("extracts the domain from a normal address", () => {
    assert.equal(extractDomain("office@taxwiseconsultants.com"), "taxwiseconsultants.com")
  })
  test("handles multi-label subdomains", () => {
    assert.equal(extractDomain("a.b@sub.example.co.uk"), "sub.example.co.uk")
  })
  test("lowercases the domain", () => {
    assert.equal(extractDomain("X@Example.COM"), "example.com")
  })
  test("rejects an address with no @", () => {
    assert.equal(extractDomain("bad-input"), null)
  })
  test("rejects an empty local part (@nohost.com)", () => {
    assert.equal(extractDomain("@nohost.com"), null)
  })
  test("rejects a domain with no TLD dot", () => {
    assert.equal(extractDomain("x@localhost"), null)
  })
  test("rejects null and undefined", () => {
    assert.equal(extractDomain(null), null)
    assert.equal(extractDomain(undefined), null)
    assert.equal(extractDomain(""), null)
  })
})

describe("resolveSenderEnvelope", () => {
  test("Mode A — verified domain sends directly from firm address", () => {
    const env = resolveSenderEnvelope(makeConfig({ domainVerified: true }))
    assert.equal(env.fromAddress, "Tax Wise Consultants <office@taxwiseconsultants.com>")
    assert.equal(env.replyTo, "office@taxwiseconsultants.com")
    assert.equal(env.usingFallback, false)
  })

  test("Mode B — unverified domain uses platform fallback but keeps firm display name + reply-to", () => {
    process.env.PLATFORM_FROM_EMAIL = "notifications@jtacs.app"
    const env = resolveSenderEnvelope(makeConfig({ domainVerified: false, platformFallbackEnabled: true }))
    assert.equal(env.usingFallback, true)
    assert.ok(env.fromAddress.startsWith("Tax Wise Consultants <"))
    assert.ok(env.fromAddress.includes("notifications@jtacs.app"))
    // Reply-To must still route back to the firm
    assert.equal(env.replyTo, "office@taxwiseconsultants.com")
  })

  test("refuses to send when no firm email and no fallback configured", () => {
    const prevPlatform = process.env.PLATFORM_FROM_EMAIL
    const prevFrom = process.env.FROM_EMAIL
    delete process.env.PLATFORM_FROM_EMAIL
    delete process.env.FROM_EMAIL
    const env = resolveSenderEnvelope(
      makeConfig({ fromEmail: "", replyToEmail: null, domainVerified: false, firmDomain: null })
    )
    assert.equal(env.fromAddress, "")
    assert.match(env.reason, /not configured/i)
    if (prevPlatform) process.env.PLATFORM_FROM_EMAIL = prevPlatform
    if (prevFrom) process.env.FROM_EMAIL = prevFrom
  })

  test("falls back to fromEmail as reply-to when replyToEmail is null", () => {
    const env = resolveSenderEnvelope(makeConfig({ domainVerified: true, replyToEmail: null }))
    assert.equal(env.replyTo, "office@taxwiseconsultants.com")
  })
})

describe("buildDnsInstructions", () => {
  const recs = buildDnsInstructions("taxwiseconsultants.com", "jtacs-verify=abc123")

  test("returns exactly 4 records", () => {
    assert.equal(recs.length, 4)
  })
  test("includes an ownership-verification TXT at _jtacs-verify.<domain>", () => {
    const v = recs.find((r) => r.host === "_jtacs-verify.taxwiseconsultants.com")
    assert.ok(v)
    assert.equal(v!.type, "TXT")
    assert.equal(v!.value, "jtacs-verify=abc123")
    assert.equal(v!.required, true)
  })
  test("includes an SPF record with amazonses include", () => {
    const spf = recs.find((r) => r.value.startsWith("v=spf1"))
    assert.ok(spf)
    assert.ok(spf!.value.includes("amazonses.com"))
  })
  test("includes a DKIM CNAME at resend._domainkey", () => {
    const dkim = recs.find((r) => r.host.includes("_domainkey"))
    assert.ok(dkim)
    assert.equal(dkim!.type, "CNAME")
  })
  test("includes a DMARC record marked optional", () => {
    const dmarc = recs.find((r) => r.host === "_dmarc.taxwiseconsultants.com")
    assert.ok(dmarc)
    assert.equal(dmarc!.required, false)
  })
})

describe("getPlatformFallbackFrom", () => {
  test("reads PLATFORM_FROM_EMAIL when set", () => {
    process.env.PLATFORM_FROM_EMAIL = "platform@example.com"
    assert.equal(getPlatformFallbackFrom(), "platform@example.com")
  })
})

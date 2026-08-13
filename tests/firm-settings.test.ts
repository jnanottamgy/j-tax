/**
 * Unit tests for the firm-branded email identity logic.
 * Pure functions — no DB access. Run with: npm test
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  extractDomain,
  resolveSenderEnvelope,
  getPlatformFallbackFrom,
  type FirmConfig,
} from "@/lib/firm-settings"

function makeConfig(overrides: Partial<FirmConfig> = {}): FirmConfig {
  return {
    firmName: "Acme & Co Chartered Accountants",
    fromEmail: "office@acmeca.com",
    replyToEmail: "office@acmeca.com",
    firmPhone: null,
    firmAddress: null,
    gstin: null,
    pan: null,
    website: null,
    firmDomain: "acmeca.com",
    domainVerified: false,
    domainVerifiedAt: null,
    resendDomainId: null,
    domainStatus: null,
    verificationToken: null,
    platformFallbackEnabled: true,
    bankAccountName: null,
    bankAccountNumber: null,
    bankIfsc: null,
    bankName: null,
    upiId: null,
    icaiFrn: null,
    icaiMembershipNo: null,
    invoiceApprovalLimit: null,
    logoUpdatedAt: null,
    logoFileName: null,
    ...overrides,
  }
}

describe("extractDomain", () => {
  test("extracts the domain from a normal address", () => {
    assert.equal(extractDomain("office@acmeca.com"), "acmeca.com")
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
    assert.equal(env.fromAddress, "Acme & Co Chartered Accountants <office@acmeca.com>")
    assert.equal(env.replyTo, "office@acmeca.com")
    assert.equal(env.usingFallback, false)
  })

  test("Mode B — unverified domain uses platform fallback but keeps firm display name + reply-to", () => {
    process.env.PLATFORM_FROM_EMAIL = "notifications@jtacs.app"
    const env = resolveSenderEnvelope(makeConfig({ domainVerified: false, platformFallbackEnabled: true }))
    assert.equal(env.usingFallback, true)
    assert.ok(env.fromAddress.startsWith("Acme & Co Chartered Accountants <"))
    assert.ok(env.fromAddress.includes("notifications@jtacs.app"))
    // Reply-To must still route back to the firm
    assert.equal(env.replyTo, "office@acmeca.com")
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
    assert.equal(env.replyTo, "office@acmeca.com")
  })
})

describe("getPlatformFallbackFrom", () => {
  test("reads PLATFORM_FROM_EMAIL when set", () => {
    process.env.PLATFORM_FROM_EMAIL = "platform@example.com"
    assert.equal(getPlatformFallbackFrom(), "platform@example.com")
  })
})

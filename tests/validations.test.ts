/**
 * Unit tests for the validation schemas that gate financial + auth input.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { invoiceSchema, recordPaymentSchema } from "@/lib/validations/invoice"
import { passwordSchema } from "@/lib/validations/settings"
import { createClientSchema, updateClientSchema } from "@/lib/validations/client"

// Service-based billing: a professional fee + GST slab — no quantity/amount.
const baseInvoice = {
  clientId: "c1",
  invoiceNumber: "INV-001",
  serviceDescription: "GST return filing — Jul 2026",
  professionalFee: "1000",
  taxRate: "18" as const,
  issueDate: "2026-01-01",
  dueDate: "2026-01-31",
  status: "DRAFT" as const,
}

describe("invoiceSchema", () => {
  test("accepts a well-formed invoice", () => {
    assert.equal(invoiceSchema.safeParse(baseInvoice).success, true)
  })

  test("rejects due date before issue date", () => {
    const r = invoiceSchema.safeParse({ ...baseInvoice, issueDate: "2026-01-31", dueDate: "2026-01-01" })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(r.error.issues.some((i) => i.path.includes("dueDate")))
    }
  })

  test("accepts due date equal to issue date", () => {
    const r = invoiceSchema.safeParse({ ...baseInvoice, issueDate: "2026-01-15", dueDate: "2026-01-15" })
    assert.equal(r.success, true)
  })

  test("rejects zero and negative professional fees", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, professionalFee: "0" }).success, false)
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, professionalFee: "-500" }).success, false)
  })

  test("rejects a non-numeric professional fee", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, professionalFee: "abc" }).success, false)
  })

  test("rejects a fee over the ₹10,00,00,000 ceiling", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, professionalFee: "100000001" }).success, false)
  })

  test("invoice number is optional (auto-generated server-side)", () => {
    const { invoiceNumber: _omit, ...noNumber } = baseInvoice
    assert.equal(invoiceSchema.safeParse(noNumber).success, true)
  })

  test("rejects a missing service description", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, serviceDescription: "" }).success, false)
  })

  test("rejects a GST rate outside the statutory slabs", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, taxRate: "17" }).success, false)
  })
})

describe("recordPaymentSchema", () => {
  test("accepts a positive payment", () => {
    assert.equal(recordPaymentSchema.safeParse({ amount: "500" }).success, true)
  })
  test("rejects a zero / negative payment", () => {
    assert.equal(recordPaymentSchema.safeParse({ amount: "0" }).success, false)
    assert.equal(recordPaymentSchema.safeParse({ amount: "-1" }).success, false)
  })
})

describe("createClientSchema — India statutory checks", () => {
  const baseClient = {
    name: "Acme Traders",
    services: [{ serviceType: "GST_RETURN" as const, frequency: "MONTHLY" as const }],
  }

  test("accepts a client with checksum-valid GSTIN and matching PAN", () => {
    const r = createClientSchema.safeParse({
      ...baseClient,
      gstin: "27AAPFU0939F1ZV",
      pan: "AAPFU0939F",
    })
    assert.equal(r.success, true, JSON.stringify(!r.success ? r.error.issues : []))
  })

  test("rejects a GSTIN with a check-digit typo, with a specific message", () => {
    const r = createClientSchema.safeParse({ ...baseClient, gstin: "27AAPFU0939F1ZW" })
    assert.equal(r.success, false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("gstin"))
      assert.ok(issue?.message.includes("check digit"), issue?.message)
    }
  })

  test("rejects GSTIN↔PAN mismatch on the pan field", () => {
    const r = createClientSchema.safeParse({
      ...baseClient,
      gstin: "27AAPFU0939F1ZV",
      pan: "ABCPE1234F",
    })
    assert.equal(r.success, false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("pan"))
      assert.ok(issue?.message.includes("AAPFU0939F"), issue?.message)
    }
  })

  test("lowercase input is normalized before checking", () => {
    const r = createClientSchema.safeParse({ ...baseClient, gstin: " 27aapfu0939f1zv " })
    assert.equal(r.success, true)
  })

  test("updateClientSchema carries the same statutory checks", () => {
    const r = updateClientSchema.safeParse({
      name: "Acme Traders",
      status: "ACTIVE" as const,
      gstin: "27AAPFU0939F1ZW", // bad check digit
    })
    assert.equal(r.success, false)
  })
})

describe("passwordSchema — complexity policy", () => {
  const ok = { currentPassword: "whatever", newPassword: "Str0ng!pass", confirmPassword: "Str0ng!pass" }

  test("accepts a compliant password", () => {
    assert.equal(passwordSchema.safeParse(ok).success, true)
  })
  test("rejects when too short", () => {
    assert.equal(passwordSchema.safeParse({ ...ok, newPassword: "Ab1!", confirmPassword: "Ab1!" }).success, false)
  })
  test("rejects when missing uppercase", () => {
    assert.equal(passwordSchema.safeParse({ ...ok, newPassword: "str0ng!pass", confirmPassword: "str0ng!pass" }).success, false)
  })
  test("rejects when missing a number", () => {
    assert.equal(passwordSchema.safeParse({ ...ok, newPassword: "Strong!pass", confirmPassword: "Strong!pass" }).success, false)
  })
  test("rejects when missing a special character", () => {
    assert.equal(passwordSchema.safeParse({ ...ok, newPassword: "Str0ngpass1", confirmPassword: "Str0ngpass1" }).success, false)
  })
  test("rejects when confirmation does not match", () => {
    const r = passwordSchema.safeParse({ ...ok, confirmPassword: "Different1!" })
    assert.equal(r.success, false)
    if (!r.success) assert.ok(r.error.issues.some((i) => i.path.includes("confirmPassword")))
  })
})

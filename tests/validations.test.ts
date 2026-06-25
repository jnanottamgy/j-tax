/**
 * Unit tests for the validation schemas that gate financial + auth input.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { invoiceSchema, recordPaymentSchema } from "@/lib/validations/invoice"
import { passwordSchema } from "@/lib/validations/settings"

const baseInvoice = {
  clientId: "c1",
  invoiceNumber: "INV-001",
  amount: "1000",
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

  test("rejects zero and negative amounts", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, amount: "0" }).success, false)
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, amount: "-500" }).success, false)
  })

  test("rejects non-numeric amount", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, amount: "abc" }).success, false)
  })

  test("rejects an amount over the ₹10,00,00,000 ceiling", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, amount: "100000001" }).success, false)
  })

  test("rejects an empty invoice number", () => {
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, invoiceNumber: "" }).success, false)
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

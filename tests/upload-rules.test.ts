/**
 * What a client may upload, and where it lands.
 *
 * This is the one path where someone who is not staff puts bytes on the firm's
 * infrastructure, so the rules are worth pinning: an allow-list rather than a
 * block-list, an extension that has to agree with the declared type, and a
 * storage key that a client-supplied file name cannot steer.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  MAX_UPLOAD_BYTES,
  buildStoragePath,
  sanitiseFileName,
  validateUpload,
} from "@/lib/documents/upload-rules"

const ok = (over = {}) => ({
  fileName: "bank-statement.pdf",
  fileSize: 500_000,
  fileType: "application/pdf",
  ...over,
})

describe("validateUpload", () => {
  test("accepts an ordinary PDF", () => {
    assert.equal(validateUpload(ok()).ok, true)
  })

  test("refuses a type that is not on the list", () => {
    // An allow-list, so anything unnamed is refused without needing to have
    // anticipated it.
    const r = validateUpload(ok({ fileName: "x.exe", fileType: "application/x-msdownload" }))
    assert.equal(r.ok, false)
  })

  test("refuses an executable wearing a PDF content type", () => {
    // The attack this exists for: the browser reports application/pdf, the
    // file is statement.exe. One comparison catches it.
    const r = validateUpload(ok({ fileName: "statement.exe", fileType: "application/pdf" }))
    assert.equal(r.ok, false)
    assert.match(r.ok === false ? r.error : "", /ends in/)
  })

  test("refuses a double extension that ends wrong", () => {
    const r = validateUpload(ok({ fileName: "invoice.pdf.exe", fileType: "application/pdf" }))
    assert.equal(r.ok, false)
  })

  test("accepts jpg and jpeg for one image type", () => {
    assert.equal(validateUpload(ok({ fileName: "p.jpg", fileType: "image/jpeg" })).ok, true)
    assert.equal(validateUpload(ok({ fileName: "p.jpeg", fileType: "image/jpeg" })).ok, true)
  })

  test("refuses an empty file", () => {
    assert.equal(validateUpload(ok({ fileSize: 0 })).ok, false)
  })

  test("refuses a file over the size cap and says how big it was", () => {
    const r = validateUpload(ok({ fileSize: MAX_UPLOAD_BYTES + 1 }))
    assert.equal(r.ok, false)
    assert.match(r.ok === false ? r.error : "", /MB/)
  })

  test("accepts a file exactly at the cap", () => {
    assert.equal(validateUpload(ok({ fileSize: MAX_UPLOAD_BYTES })).ok, true)
  })

  test("refuses a nameless file", () => {
    assert.equal(validateUpload(ok({ fileName: "   " })).ok, false)
  })

  test("refuses a file with no extension at all", () => {
    assert.equal(validateUpload(ok({ fileName: "statement" })).ok, false)
  })
})

describe("sanitiseFileName", () => {
  test("strips traversal segments", () => {
    const s = sanitiseFileName("../../etc/passwd.pdf")
    assert.ok(!s.includes(".."))
    assert.ok(!s.includes("/"))
  })

  test("keeps the extension", () => {
    assert.match(sanitiseFileName("GST Return Q1.pdf"), /\.pdf$/)
  })

  test("keeps a readable stem so a partner can recognise the file", () => {
    assert.equal(sanitiseFileName("GST Return Q1.pdf"), "GST-Return-Q1.pdf")
  })

  test("survives a name made entirely of stripped characters", () => {
    // Must not produce an empty key, or the object becomes unaddressable.
    const s = sanitiseFileName("///...///.pdf")
    assert.match(s, /^document\.pdf$|^\w.*\.pdf$/)
    assert.ok(s.length > 4)
  })

  test("keeps non-Latin names rather than blanking them", () => {
    // A Devanagari file name is ordinary here and must not be reduced to
    // "document" — that would make every such upload look identical.
    const s = sanitiseFileName("बैंक-विवरण.pdf")
    assert.ok(s.length > 4)
    assert.match(s, /\.pdf$/)
  })

  test("truncates an absurdly long name", () => {
    const s = sanitiseFileName(`${"a".repeat(500)}.pdf`)
    assert.ok(s.length <= 85)
  })
})

describe("buildStoragePath", () => {
  const base = {
    firmId: "firm_1",
    clientId: "cl_1",
    requestItemId: "item_1",
    unique: "abc123",
  }

  test("is scoped firm-first, so one tenant's prefix cannot enumerate another's", () => {
    const p = buildStoragePath({ ...base, fileName: "x.pdf" })
    assert.ok(p.startsWith("firm_1/cl_1/requests/item_1/"))
  })

  test("a hostile file name cannot escape the prefix", () => {
    const p = buildStoragePath({ ...base, fileName: "../../../secrets.pdf" })
    assert.ok(p.startsWith("firm_1/cl_1/requests/item_1/"))
    assert.equal(p.split("/").length, 5)
  })

  test("two uploads of the same name do not collide", () => {
    const a = buildStoragePath({ ...base, fileName: "pan.pdf", unique: "one" })
    const b = buildStoragePath({ ...base, fileName: "pan.pdf", unique: "two" })
    assert.notEqual(a, b)
  })
})

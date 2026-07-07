/**
 * Unit tests for the dependency-free CSV parser/serializer.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseCsv, parseCsvObjects, toCsv } from "@/lib/csv/parse"

describe("parseCsv", () => {
  test("basic rows with CRLF and LF", () => {
    const { headers, rows } = parseCsv("a,b,c\r\n1,2,3\n4,5,6")
    assert.deepEqual(headers, ["a", "b", "c"])
    assert.deepEqual(rows, [["1", "2", "3"], ["4", "5", "6"]])
  })

  test("quoted fields with commas, quotes, and newlines", () => {
    const text = 'name,address\n"Acme, Pvt Ltd","Line 1\nLine 2"\n"He said ""hi""",x'
    const { rows } = parseCsv(text)
    assert.deepEqual(rows[0], ["Acme, Pvt Ltd", "Line 1\nLine 2"])
    assert.deepEqual(rows[1], ['He said "hi"', "x"])
  })

  test("strips BOM and skips blank lines, pads ragged rows", () => {
    const text = "﻿a,b,c\n1,2\n\n4,5,6,7\n"
    const { headers, rows } = parseCsv(text)
    assert.deepEqual(headers, ["a", "b", "c"])
    assert.deepEqual(rows, [["1", "2", ""], ["4", "5", "6"]])
  })

  test("objects keyed by header", () => {
    const objs = parseCsvObjects("name,gstin\nAcme,27AAPFU0939F1ZV")
    assert.deepEqual(objs, [{ name: "Acme", gstin: "27AAPFU0939F1ZV" }])
  })

  test("empty input", () => {
    assert.deepEqual(parseCsv(""), { headers: [], rows: [] })
  })
})

describe("toCsv", () => {
  test("quotes only when needed and round-trips", () => {
    const csv = toCsv(["name", "note"], [["Acme, Pvt", 'said "hi"'], ["Plain", "ok"]])
    assert.equal(csv, 'name,note\r\n"Acme, Pvt","said ""hi"""\r\nPlain,ok')
    const back = parseCsv(csv)
    assert.deepEqual(back.rows, [["Acme, Pvt", 'said "hi"'], ["Plain", "ok"]])
  })

  test("null/undefined render empty", () => {
    assert.equal(toCsv(["a", "b"], [[null, undefined]]), "a,b\r\n,")
  })
})

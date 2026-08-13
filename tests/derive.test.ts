/**
 * Facts the app works out for itself.
 *
 * The rule these pin: derive into EMPTY fields only. A typed value is a
 * decision, and a derivation that overwrites one is worse than no derivation at
 * all — it silently changes what the user entered on a document that gets filed.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  clientTypeFromPan,
  deriveClientFields,
  entityTypeLabelFromPan,
  panFromGstin,
  stateCodeFromGstin,
  stateNameFromGstin,
} from "@/lib/clients/derive"
import { bankFromIfsc, gstinCheckDigit } from "@/lib/india/validators"

/** A GSTIN carrying a given PAN, with a correct check digit. */
function gstinFor(stateCode: string, pan: string, entity = "1"): string {
  const first14 = `${stateCode}${pan}${entity}Z`
  return first14 + gstinCheckDigit(first14)
}

describe("panFromGstin", () => {
  test("extracts the PAN from characters 3–12", () => {
    const gstin = gstinFor("27", "AAACS1429B")
    assert.equal(panFromGstin(gstin), "AAACS1429B")
  })

  test("refuses a GSTIN whose check digit is wrong", () => {
    // A mistyped GSTIN would otherwise hand back a mistyped PAN, and both would
    // print on the invoice looking authoritative.
    const good = gstinFor("27", "AAACS1429B")
    const bad = good.slice(0, 14) + (good[14] === "Z" ? "1" : "Z")
    assert.equal(panFromGstin(bad), null)
  })

  test("returns null for empty or partial input", () => {
    assert.equal(panFromGstin(""), null)
    assert.equal(panFromGstin(null), null)
    assert.equal(panFromGstin("27AAACS"), null)
  })
})

describe("stateCodeFromGstin", () => {
  test("reads the state from the first two digits", () => {
    assert.equal(stateCodeFromGstin(gstinFor("27", "AAACS1429B")), "27")
    assert.equal(stateNameFromGstin(gstinFor("27", "AAACS1429B")), "Maharashtra")
  })

  test("works on a partial GSTIN, before the check digit can be verified", () => {
    // The state is knowable from two characters; waiting for a valid checksum
    // would mean the place of supply stays blank while someone is still typing,
    // and for a client mid-registration it would never fill at all.
    assert.equal(stateCodeFromGstin("07ABCDE"), "07")
  })

  test("rejects a code that is not a real GST state", () => {
    assert.equal(stateCodeFromGstin("99ABCDE1234F1Z5"), null)
  })
})

describe("clientTypeFromPan", () => {
  test("maps the unambiguous constitutions", () => {
    assert.equal(clientTypeFromPan("AAAHS1234B"), "HUF")
    assert.equal(clientTypeFromPan("AAATS1234B"), "TRUST")
    assert.equal(clientTypeFromPan("AAAAS1234B"), "AOP")
  })

  test("does not guess a company's exact form", () => {
    // "C" covers Pvt Ltd, Public Ltd, Section 8 and OPC. Picking one would be
    // wrong three times out of four.
    assert.equal(clientTypeFromPan("AAACS1429B"), null)
  })

  test("does not guess between a firm and an LLP", () => {
    assert.equal(clientTypeFromPan("AAAFS1234B"), null)
  })

  test("does not guess between an individual and a proprietorship", () => {
    // A sole proprietor uses their own PAN, so "P" is genuinely both. They file
    // different returns and hit different audit thresholds.
    assert.equal(clientTypeFromPan("AAAPS1234B"), null)
  })

  test("still reports what PAN says, even when it cannot be mapped", () => {
    assert.equal(entityTypeLabelFromPan("AAACS1429B"), "Company")
    assert.equal(entityTypeLabelFromPan("AAAPS1234B"), "Individual")
    assert.equal(entityTypeLabelFromPan("AAAFS1234B"), "Firm / LLP")
  })

  test("returns null for a malformed PAN", () => {
    assert.equal(clientTypeFromPan("NOTAPAN"), null)
    assert.equal(entityTypeLabelFromPan("AAAZS1234B"), null)
  })
})

describe("deriveClientFields — fills gaps, never overwrites", () => {
  const gstin = gstinFor("27", "AAAHS1234B")

  test("a GSTIN alone yields PAN, state and constitution", () => {
    const out = deriveClientFields({ gstin })
    assert.equal(out.pan, "AAAHS1234B")
    assert.equal(out.stateCode, "27")
    assert.equal(out.clientType, "HUF")
  })

  test("an already-typed PAN is left alone", () => {
    // Deliberate: a GSTIN and PAN can legitimately disagree during a
    // restructuring, and the cross-check warns about it. Silently rewriting the
    // PAN would hide the very thing the user needs to see.
    const out = deriveClientFields({ gstin, pan: "ZZZZZ9999Z" })
    assert.equal(out.pan, undefined)
  })

  test("an already-chosen client type is left alone", () => {
    const out = deriveClientFields({ gstin, clientType: "PVT_LTD" })
    assert.equal(out.clientType, undefined)
  })

  test("an already-known state is left alone", () => {
    const out = deriveClientFields({ gstin, stateCode: "07" })
    assert.equal(out.stateCode, undefined)
  })

  test("the constitution derives from a PAN that was itself just derived", () => {
    // Entering only a GSTIN has to fill the type too, or the chain stops one
    // link short and the user still picks from a dropdown.
    const out = deriveClientFields({ gstin, pan: "" })
    assert.equal(out.clientType, "HUF")
  })

  test("nothing entered yields nothing", () => {
    assert.deepEqual(deriveClientFields({}), {})
  })
})

describe("bankFromIfsc", () => {
  test("reads the bank from the first four characters", () => {
    assert.equal(bankFromIfsc("HDFC0001234"), "HDFC Bank")
    assert.equal(bankFromIfsc("SBIN0000123"), "State Bank of India")
    assert.equal(bankFromIfsc("UTIB0001234"), "Axis Bank")
  })

  test("is case- and whitespace-insensitive", () => {
    assert.equal(bankFromIfsc(" hdfc0001234 "), "HDFC Bank")
  })

  test("works from the bank code alone, before the branch is typed", () => {
    assert.equal(bankFromIfsc("KKBK"), "Kotak Mahindra Bank")
  })

  test("returns null for a bank not in the list rather than guessing", () => {
    // The list is deliberately partial; a wrong bank name on a payment
    // instruction is worse than a blank one.
    assert.equal(bankFromIfsc("ZZZZ0001234"), null)
  })

  test("returns null for input too short to carry a bank code", () => {
    assert.equal(bankFromIfsc("HDF"), null)
    assert.equal(bankFromIfsc(""), null)
    assert.equal(bankFromIfsc(null), null)
  })
})

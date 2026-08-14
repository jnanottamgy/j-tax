/**
 * Which firm a client-portal login belongs to.
 *
 * The scenario these exist for: one person, one email address, one login — and
 * two firms on the platform who both have them on the books. Tenant scoping
 * keeps the two firms' data apart; what was ambiguous was deciding whose portal
 * this login is, because the decision was a match against `Client.email` and
 * that column is not unique.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { chooseAdoptionFirm } from "@/lib/auth/portal-identity"

const A = { clientId: "cl_a", firmId: "firm_a" }
const B = { clientId: "cl_b", firmId: "firm_b" }

describe("chooseAdoptionFirm", () => {
  test("an explicit grant wins over an email match in another firm", () => {
    // The regression this exists for. Firm A actually invited this person;
    // Firm B merely happens to hold a client record with the same address.
    // Going by email alone made that a tie and locked the client out of the
    // portal their own accountant had granted them.
    const d = chooseAdoptionFirm({ linked: [A], byEmail: [A, B] })
    assert.equal(d.ok, true)
    assert.equal(d.ok === true ? d.firmId : "", "firm_a")
    assert.equal(d.ok === true ? d.via : "", "link")
  })

  test("grants in two firms are refused, not guessed", () => {
    // @@unique([firmId, portalUserId]) permits one grant per firm, but a
    // session belongs to exactly one firm. Picking either would show somebody
    // the wrong firm's deadlines and invoices, confidently.
    const d = chooseAdoptionFirm({ linked: [A, B], byEmail: [] })
    assert.deepEqual(d, { ok: false, reason: "ambiguous" })
  })

  test("with no grant, a single email match still works", () => {
    // Hand-provisioned logins predate portal invites and must keep working.
    const d = chooseAdoptionFirm({ linked: [], byEmail: [A] })
    assert.equal(d.ok, true)
    assert.equal(d.ok === true ? d.via : "", "email")
  })

  test("two firms sharing a client email, and no grant, is refused", () => {
    const d = chooseAdoptionFirm({ linked: [], byEmail: [A, B] })
    assert.deepEqual(d, { ok: false, reason: "ambiguous" })
  })

  test("two records in the SAME firm sharing an email is also refused", () => {
    // The firm would be unambiguous here, but which client the visitor *is*
    // would not — and that is the thing being decided.
    const sameFirm = { clientId: "cl_b", firmId: "firm_a" }
    const d = chooseAdoptionFirm({ linked: [], byEmail: [A, sameFirm] })
    assert.deepEqual(d, { ok: false, reason: "ambiguous" })
  })

  test("nothing at all is 'none', which is a different answer from ambiguous", () => {
    // These need different messages: one is "we don't know you", the other is
    // "we know you twice". The old code gave both the same dead end.
    const d = chooseAdoptionFirm({ linked: [], byEmail: [] })
    assert.deepEqual(d, { ok: false, reason: "none" })
  })

  test("a lone grant needs no email match at all", () => {
    // A client invited under an address different from the one on their record
    // is the normal case for a firm that invites a finance contact.
    const d = chooseAdoptionFirm({ linked: [B], byEmail: [] })
    assert.equal(d.ok, true)
    assert.equal(d.ok === true ? d.clientId : "", "cl_b")
  })
})

/**
 * Tenant-isolation regression tests.
 *
 * Context: lib/prisma.ts auto-injects `firmId` into the ~33 top-level models
 * that carry the column. CHILD tables (ClientCredential, ClientContact,
 * ClientTeamMember, TaskComment, TaskAttachment, TaskChecklistItem, …) have no
 * firmId, so a row fetched directly by its own id bypasses tenancy entirely.
 *
 * That was a live cross-firm hole: `revealCredentialPassword(id)` decrypted and
 * returned another firm's government-portal password to any Partner/Manager who
 * supplied the id. The fix is the relational firm filter exercised here — every
 * child-table query must carry it.
 *
 * These tests pin the two properties that make the filter safe:
 *   1. it always narrows to the CALLER's firm, and
 *   2. it FAILS CLOSED when there is no tenant context — never degrading into
 *      an unscoped query that would read across every firm on the platform.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { clientFirmFilter, taskFirmFilter } from "@/lib/auth/scope"
import type { SessionInfo } from "@/lib/auth/types"

function session(firmId?: string): SessionInfo {
  return {
    user: {
      id: "user_1",
      email: "partner@firm-a.test",
      name: "Partner",
      role: "PARTNER",
      ...(firmId ? { firmId } : {}),
    },
  }
}

describe("clientFirmFilter", () => {
  test("narrows to the caller's firm through the client relation", () => {
    assert.deepEqual(clientFirmFilter(session("firm_a")), {
      client: { firmId: "firm_a" },
    })
  })

  test("spreads into a where clause without clobbering the id", () => {
    const where = { id: "cred_1", ...clientFirmFilter(session("firm_a")) }
    assert.deepEqual(where, { id: "cred_1", client: { firmId: "firm_a" } })
  })

  test("carries the caller's firm, never a caller-supplied one", () => {
    // The whole point: the filter is derived from the session, so a request
    // naming another firm's row still gets scoped to the caller's firm.
    assert.equal(clientFirmFilter(session("firm_a")).client.firmId, "firm_a")
    assert.notEqual(clientFirmFilter(session("firm_a")).client.firmId, "firm_b")
  })

  test("FAILS CLOSED with no tenant context", () => {
    // Must throw — returning `{}` here would silently widen every child-table
    // query to the entire platform.
    assert.throws(() => clientFirmFilter(session()), /no tenant context/i)
  })
})

describe("taskFirmFilter", () => {
  test("narrows to the caller's firm through the task relation", () => {
    assert.deepEqual(taskFirmFilter(session("firm_a")), {
      task: { firmId: "firm_a" },
    })
  })

  test("spreads into a where clause without clobbering the id", () => {
    const where = { id: "comment_1", ...taskFirmFilter(session("firm_a")) }
    assert.deepEqual(where, { id: "comment_1", task: { firmId: "firm_a" } })
  })

  test("FAILS CLOSED with no tenant context", () => {
    assert.throws(() => taskFirmFilter(session()), /no tenant context/i)
  })
})

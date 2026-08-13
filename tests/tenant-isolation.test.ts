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
import { readFileSync } from "node:fs"

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

describe("clientFirmFilter — merging into an existing client condition", () => {
  // ClientService carries no firmId, so the Prisma tenant extension injects
  // nothing for it. Every engagement query has to reach the firm through the
  // parent Client — and the spread has to MERGE into that nested object, not
  // replace it. Getting this wrong is silent: the query still runs, still
  // returns rows, and simply returns other firms' rows too.
  test("merged into a nested client condition, both conditions survive", () => {
    const where = {
      isActive: true,
      client: { ...clientFirmFilter(session("firm_a")).client, id: "cli_1" },
    }
    assert.deepEqual(where, {
      isActive: true,
      client: { firmId: "firm_a", id: "cli_1" },
    })
  })

  test("spreading ALONGSIDE a client key drops the firm — the shape to avoid", () => {
    // Pinned as a counter-example so the correct form above is not "fixed"
    // back into this one by someone tidying the spread.
    const wrong = { ...clientFirmFilter(session("firm_a")), client: { id: "cli_1" } }
    assert.deepEqual(wrong.client, { id: "cli_1" })
    assert.equal("firmId" in wrong.client, false)
  })

  test("still fails closed with no tenant context", () => {
    assert.throws(
      () => ({ client: { ...clientFirmFilter(session()).client, id: "cli_1" } }),
      /Unauthorized: no tenant context/
    )
  })
})

describe("TENANT_MODELS covers every model that carries a firmId", () => {
  // The extension in lib/prisma.ts injects firmId only for models named in
  // TENANT_MODELS. Adding a new top-level model and forgetting to register it
  // produces no error, no type failure and no test failure — the queries simply
  // run unscoped and read across every firm on the platform. This reads the
  // schema and the registry directly so the omission cannot go unnoticed.
  const schema = readFileSync(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8"
  )
  const source = readFileSync(new URL("../lib/prisma.ts", import.meta.url), "utf8")

  const registered = new Set(
    (/const TENANT_MODELS = new Set\(\[([\s\S]*?)\]\)/.exec(source)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean)
  )

  /** Models declaring their own `firmId` scalar — i.e. top-level tenant data. */
  const withFirmId = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)]
    .filter(([, , body]) => /^\s*firmId\s+String/m.test(body))
    .map(([, name]) => name)
    // Firm itself is the tenant, not tenant-scoped data.
    .filter((name) => name !== "Firm")

  test("the schema actually has tenant models to check", () => {
    assert.ok(withFirmId.length > 20, `found only ${withFirmId.length}`)
  })

  for (const model of withFirmId) {
    test(`${model} is registered`, () => {
      assert.ok(
        registered.has(model),
        `${model} declares firmId but is missing from TENANT_MODELS in lib/prisma.ts — its queries would run unscoped across every firm.`
      )
    })
  }
})

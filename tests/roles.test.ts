/**
 * Unit tests for RBAC route-access logic — the server-side guard the proxy
 * and layouts rely on. A regression here is a privilege-escalation bug, so
 * these are the highest-value tests in the suite.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  canAccessRoute,
  hasRole,
  hasMinimumRole,
  parseAppRole,
  ROLE_LEVEL,
} from "@/lib/auth/roles"

describe("parseAppRole", () => {
  test("accepts the four canonical roles (case-insensitive)", () => {
    assert.equal(parseAppRole("PARTNER"), "PARTNER")
    assert.equal(parseAppRole("manager"), "MANAGER")
    assert.equal(parseAppRole("Employee"), "EMPLOYEE")
    assert.equal(parseAppRole("client"), "CLIENT")
  })
  test("rejects unknown / malformed roles", () => {
    assert.equal(parseAppRole("ADMIN"), null)
    assert.equal(parseAppRole("EXECUTIVE"), null) // old role, removed
    assert.equal(parseAppRole(""), null)
    assert.equal(parseAppRole(null), null)
    assert.equal(parseAppRole(undefined), null)
    assert.equal(parseAppRole(42), null)
  })
})

describe("ROLE_LEVEL ordering", () => {
  test("PARTNER > MANAGER > EMPLOYEE > CLIENT", () => {
    assert.ok(ROLE_LEVEL.PARTNER > ROLE_LEVEL.MANAGER)
    assert.ok(ROLE_LEVEL.MANAGER > ROLE_LEVEL.EMPLOYEE)
    assert.ok(ROLE_LEVEL.EMPLOYEE > ROLE_LEVEL.CLIENT)
  })
})

describe("hasMinimumRole", () => {
  test("PARTNER satisfies every minimum", () => {
    assert.equal(hasMinimumRole("PARTNER", "EMPLOYEE"), true)
    assert.equal(hasMinimumRole("PARTNER", "PARTNER"), true)
  })
  test("EMPLOYEE does not satisfy MANAGER minimum", () => {
    assert.equal(hasMinimumRole("EMPLOYEE", "MANAGER"), false)
  })
})

describe("canAccessRoute — privilege boundaries", () => {
  // /activity — PARTNER only
  test("/activity is PARTNER-only", () => {
    assert.equal(canAccessRoute("PARTNER", "/activity"), true)
    assert.equal(canAccessRoute("MANAGER", "/activity"), false)
    assert.equal(canAccessRoute("EMPLOYEE", "/activity"), false)
    assert.equal(canAccessRoute("CLIENT", "/activity"), false)
  })

  // /workforce — PARTNER only
  test("/workforce is PARTNER-only", () => {
    assert.equal(canAccessRoute("PARTNER", "/workforce"), true)
    assert.equal(canAccessRoute("MANAGER", "/workforce"), false)
    assert.equal(canAccessRoute("EMPLOYEE", "/workforce"), false)
  })

  // /payments — PARTNER + MANAGER only
  test("/payments excludes EMPLOYEE and CLIENT", () => {
    assert.equal(canAccessRoute("PARTNER", "/payments"), true)
    assert.equal(canAccessRoute("MANAGER", "/payments"), true)
    assert.equal(canAccessRoute("EMPLOYEE", "/payments"), false)
    assert.equal(canAccessRoute("CLIENT", "/payments"), false)
  })

  // /employees, /reports, /proposals — PARTNER + MANAGER only
  test("/employees, /reports, /proposals exclude EMPLOYEE", () => {
    for (const route of ["/employees", "/reports", "/proposals"]) {
      assert.equal(canAccessRoute("EMPLOYEE", route), false, `${route} should block EMPLOYEE`)
      assert.equal(canAccessRoute("MANAGER", route), true, `${route} should allow MANAGER`)
    }
  })

  // Inherited (nested) routes follow their parent
  test("nested payment route inherits parent restriction", () => {
    assert.equal(canAccessRoute("EMPLOYEE", "/payments/invoices"), false)
    assert.equal(canAccessRoute("MANAGER", "/payments/invoices"), true)
  })

  // Staff routes are open to EMPLOYEE
  test("EMPLOYEE can reach core staff routes", () => {
    assert.equal(canAccessRoute("EMPLOYEE", "/"), true)
    assert.equal(canAccessRoute("EMPLOYEE", "/clients"), true)
    assert.equal(canAccessRoute("EMPLOYEE", "/work-tracker"), true)
    assert.equal(canAccessRoute("EMPLOYEE", "/compliance"), true)
  })

  // CLIENT is blocked from all staff routes, allowed on /client
  test("CLIENT is blocked from staff routes, allowed on /client", () => {
    assert.equal(canAccessRoute("CLIENT", "/"), false)
    assert.equal(canAccessRoute("CLIENT", "/clients"), false)
    assert.equal(canAccessRoute("CLIENT", "/client"), true)
  })

  // Staff cannot reach the client portal
  test("staff roles cannot reach /client", () => {
    assert.equal(canAccessRoute("PARTNER", "/client"), false)
    assert.equal(canAccessRoute("EMPLOYEE", "/client"), false)
  })
})

describe("hasRole", () => {
  test("matches membership in the allowed list", () => {
    assert.equal(hasRole("MANAGER", ["PARTNER", "MANAGER"]), true)
    assert.equal(hasRole("EMPLOYEE", ["PARTNER", "MANAGER"]), false)
  })
})

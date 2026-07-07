/**
 * "Other" service naming — the display helper and the onboarding artifact
 * builder must carry a custom name through to the ClientService record and to
 * every generated task/schedule/reminder title.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { serviceLabel } from "@/lib/clients/constants"
import { buildOnboardingArtifacts } from "@/lib/clients/onboarding"

describe("serviceLabel", () => {
  test("OTHER shows the custom name when present", () => {
    assert.equal(serviceLabel("OTHER", "Trademark registration"), "Trademark registration")
    assert.equal(serviceLabel("OTHER", "  Drafting  "), "Drafting") // trimmed
  })

  test("OTHER falls back to 'Other' when no custom name", () => {
    assert.equal(serviceLabel("OTHER", ""), "Other")
    assert.equal(serviceLabel("OTHER", "   "), "Other")
    assert.equal(serviceLabel("OTHER", null), "Other")
    assert.equal(serviceLabel("OTHER", undefined), "Other")
  })

  test("standard types ignore any custom name", () => {
    assert.equal(serviceLabel("GST_RETURN"), "GST")
    assert.equal(serviceLabel("INCOME_TAX"), "Income Tax")
    assert.equal(serviceLabel("GST_RETURN", "should be ignored"), "GST")
  })
})

describe("buildOnboardingArtifacts — OTHER naming", () => {
  test("stores customName on the ClientService and uses it in generated titles", () => {
    const artifacts = buildOnboardingArtifacts("client-1", "Acme Ltd", [
      { serviceType: "OTHER", frequency: "ONE_TIME", customName: "Trademark registration" },
    ])

    // ClientService record carries the custom name
    assert.equal(artifacts.services[0].customName, "Trademark registration")
    assert.equal(artifacts.services[0].serviceType, "OTHER")

    // Generated task/schedule/reminder titles use the custom name, not "Other"
    assert.ok(artifacts.tasks.some((t) => t.title === "Onboarding: Trademark registration setup"))
    assert.ok(artifacts.tasks.some((t) => t.title === "Collect documents for Trademark registration"))
    assert.ok(artifacts.complianceSchedules.some((s) => s.title === "Trademark registration compliance cycle"))
    assert.ok(artifacts.reminders.some((r) => String(r.title).includes("Trademark registration")))
  })

  test("standard services store null customName", () => {
    const artifacts = buildOnboardingArtifacts("client-1", "Acme Ltd", [
      { serviceType: "GST_RETURN", frequency: "MONTHLY" },
    ])
    assert.equal(artifacts.services[0].customName, null)
    assert.ok(artifacts.tasks.some((t) => t.title === "Onboarding: GST setup"))
  })
})

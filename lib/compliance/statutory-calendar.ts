import { addMonths, format } from "date-fns"

import { qrmpGstr3bDueDay, type GstScheme } from "@/lib/compliance/gst-scheme"

/**
 * Single source of truth for Indian statutory filing due dates.
 *
 * Both compliance generators consume this module:
 *  - generateComplianceEventsForClient (client creation / Client-360 button)
 *  - generateRecurringComplianceTasks  (monthly cron)
 * so their events carry identical canonical titles + filing periods and
 * dedupe against each other instead of doubling up on the calendar.
 *
 * Dates are the standard (non-extended) statutory deadlines:
 *  - GSTR-1: 11th of the month following the return period (monthly filers)
 *  - GSTR-3B: 20th of the following month (monthly filers; QRMP not modelled)
 *  - TDS deposit: 7th of the following month
 *  - TDS returns 24Q/26Q: Q1 Jul 31 · Q2 Oct 31 · Q3 Jan 31 · Q4 May 31
 *  - Advance tax: Jun 15 · Sep 15 · Dec 15 · Mar 15
 *  - ITR (non-audit): Jul 31 after FY end — audit cases: Oct 31
 *  - Tax audit report 3CA/3CB-3CD: Sep 30 after FY end
 *  - DIR-3 KYC: Sep 30 · AOC-4: Oct 30 (AGM Sep 30 + 30d) · MGT-7: Nov 28 (AGM + 60d)
 *  - PF/ESIC: 15th of the following month
 * Professional Tax is state-specific and intentionally not modelled here.
 */

export type StatutoryServiceType =
  | "GST_RETURN"
  | "INCOME_TAX"
  | "TDS"
  | "PAYROLL"
  | "BOOKKEEPING"
  | "AUDIT"
  | "COMPANY_LAW"
  | "OTHER"

export type StatutoryComplianceType =
  | "GSTR_1"
  | "GSTR_3B"
  | "TDS"
  | "ROC"
  | "ITR"
  | "PF_ESIC"
  | "AUDIT"
  | "CUSTOM"

export type Cadence = "MONTHLY" | "QUARTERLY" | "ANNUAL"

export type StatutoryEventSpec = {
  serviceType: StatutoryServiceType
  type: StatutoryComplianceType
  cadence: Cadence
  /** Canonical title — embeds the period so it doubles as the dedupe key. */
  title: string
  /** e.g. "Jul 2026", "Q1 FY2026-27", "FY2025-26" */
  filingPeriod: string
  dueDate: Date
  reminderDays: number
  description: string
}

/** Indian FY runs Apr 1 → Mar 31. Returns the calendar year the FY starts in. */
export function fyStartYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
}

/** "FY2026-27" for the FY starting April of `startYear`. */
export function fyLabel(startYear: number): string {
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
}

function inWindow(d: Date, from: Date, to: Date): boolean {
  return d >= from && d <= to
}

function monthLabel(year: number, monthIdx: number): string {
  return format(new Date(year, monthIdx, 1), "MMM yyyy")
}

/**
 * Enumerate every statutory event applicable to the given services whose due
 * date falls inside [from, to]. The full service list matters: a client with
 * an AUDIT engagement gets the Oct 31 audit-case ITR date instead of Jul 31.
 */
export function statutoryEventsInWindow(
  serviceTypes: string[],
  from: Date,
  to: Date,
  /**
   * Client-specific facts that change which returns are actually due.
   * Omitted → the previous behaviour (monthly GST), so existing callers and
   * clients with nothing recorded are unaffected.
   */
  profile?: {
    /** MONTHLY | QRMP. See lib/compliance/gst-scheme.ts. */
    gstScheme?: GstScheme
    /** GST state code — QRMP's GSTR-3B falls on the 22nd or 24th by state. */
    stateCode?: string | null
  }
): StatutoryEventSpec[] {
  const services = new Set(serviceTypes)
  const events: StatutoryEventSpec[] = []
  const isAuditCase = services.has("AUDIT")
  const qrmp = profile?.gstScheme === "QRMP"

  // FYs whose periods/dues can intersect the window. Annual dues lag the FY
  // start by up to ~20 months (Apr Y → MGT-7 Nov Y+1), hence the -2 margin.
  const firstFy = fyStartYear(from) - 2
  const lastFy = fyStartYear(to)

  for (let fy = firstFy; fy <= lastFy; fy++) {
    const label = fyLabel(fy)

    // ── Monthly cadences: return period M (Apr..Mar) → due in M+1 ──────────
    for (let m = 0; m < 12; m++) {
      const period = new Date(fy, 3 + m, 1) // Apr=3 … wraps into next year
      const pYear = period.getFullYear()
      const pMonth = period.getMonth()
      const pLabel = monthLabel(pYear, pMonth)

      if (services.has("GST_RETURN") && !qrmp) {
        const gstr1Due = new Date(pYear, pMonth + 1, 11)
        if (inWindow(gstr1Due, from, to)) {
          events.push({
            serviceType: "GST_RETURN", type: "GSTR_1", cadence: "MONTHLY",
            title: `GSTR-1 — ${pLabel}`,
            filingPeriod: pLabel, dueDate: gstr1Due, reminderDays: 5,
            description: `Outward supplies return for ${pLabel} (due 11th of the following month)`,
          })
        }
        const gstr3bDue = new Date(pYear, pMonth + 1, 20)
        if (inWindow(gstr3bDue, from, to)) {
          events.push({
            serviceType: "GST_RETURN", type: "GSTR_3B", cadence: "MONTHLY",
            title: `GSTR-3B — ${pLabel}`,
            filingPeriod: pLabel, dueDate: gstr3bDue, reminderDays: 5,
            description: `Summary return & tax payment for ${pLabel} (due 20th of the following month)`,
          })
        }
      }

      // QRMP still has a MONTHLY obligation — the tax itself. Only the returns
      // go quarterly. Missing PMT-06 is what actually costs the client interest,
      // so it matters that a quarterly filer still sees eleven dates a year.
      if (services.has("GST_RETURN") && qrmp && m % 3 !== 2) {
        const pmt06Due = new Date(pYear, pMonth + 1, 25)
        if (inWindow(pmt06Due, from, to)) {
          events.push({
            serviceType: "GST_RETURN", type: "GSTR_3B", cadence: "MONTHLY",
            title: `GST PMT-06 — ${pLabel}`,
            filingPeriod: pLabel, dueDate: pmt06Due, reminderDays: 4,
            description: `Monthly tax payment under QRMP for ${pLabel} (due 25th of the following month)`,
          })
        }
      }

      if (services.has("TDS")) {
        const depositDue = new Date(pYear, pMonth + 1, 7)
        if (inWindow(depositDue, from, to)) {
          events.push({
            serviceType: "TDS", type: "TDS", cadence: "MONTHLY",
            title: `TDS Deposit — ${pLabel}`,
            filingPeriod: pLabel, dueDate: depositDue, reminderDays: 4,
            description: `Deposit TDS deducted in ${pLabel} (due 7th of the following month)`,
          })
        }
      }

      if (services.has("PAYROLL")) {
        const pfDue = new Date(pYear, pMonth + 1, 15)
        if (inWindow(pfDue, from, to)) {
          events.push({
            serviceType: "PAYROLL", type: "PF_ESIC", cadence: "MONTHLY",
            title: `PF/ESIC Payment — ${pLabel}`,
            filingPeriod: pLabel, dueDate: pfDue, reminderDays: 5,
            description: `PF & ESIC contribution for ${pLabel} (due 15th of the following month)`,
          })
        }
      }
    }

    // ── Quarterly cadences ──────────────────────────────────────────────────

    // QRMP returns. Quarters follow the FY: Q1 = Apr-Jun. GSTR-1 lands on the
    // 13th; GSTR-3B on the 22nd or 24th depending on the taxpayer's state,
    // which is why the profile carries a state code.
    if (services.has("GST_RETURN") && qrmp) {
      const gstr3bDay = qrmpGstr3bDueDay(profile?.stateCode)
      const quarters = [
        { q: "Q1", endMonth: 6 },  // Apr-Jun → due in Jul
        { q: "Q2", endMonth: 9 },  // Jul-Sep → due in Oct
        { q: "Q3", endMonth: 12 }, // Oct-Dec → due in Jan
        { q: "Q4", endMonth: 15 }, // Jan-Mar → due in Apr
      ]
      for (const { q, endMonth } of quarters) {
        const gstr1Due = new Date(fy, endMonth, 13)
        if (inWindow(gstr1Due, from, to)) {
          events.push({
            serviceType: "GST_RETURN", type: "GSTR_1", cadence: "QUARTERLY",
            title: `GSTR-1 (QRMP) — ${q} ${label}`,
            filingPeriod: `${q} ${label}`, dueDate: gstr1Due, reminderDays: 7,
            description: `Quarterly outward supplies return for ${q} ${label} (due 13th of the month following the quarter)`,
          })
        }
        const gstr3bDue = new Date(fy, endMonth, gstr3bDay)
        if (inWindow(gstr3bDue, from, to)) {
          events.push({
            serviceType: "GST_RETURN", type: "GSTR_3B", cadence: "QUARTERLY",
            title: `GSTR-3B (QRMP) — ${q} ${label}`,
            filingPeriod: `${q} ${label}`, dueDate: gstr3bDue, reminderDays: 7,
            description: `Quarterly summary return for ${q} ${label} (due ${gstr3bDay}th of the month following the quarter)`,
          })
        }
      }
    }

    if (services.has("TDS")) {
      // TDS returns 24Q/26Q — Q4 (Jan-Mar) is due May 31 of the NEXT year.
      const tdsReturns = [
        { q: "Q1", due: new Date(fy, 6, 31) },      // Jul 31
        { q: "Q2", due: new Date(fy, 9, 31) },      // Oct 31
        { q: "Q3", due: new Date(fy + 1, 0, 31) },  // Jan 31
        { q: "Q4", due: new Date(fy + 1, 4, 31) },  // May 31
      ]
      for (const { q, due } of tdsReturns) {
        if (inWindow(due, from, to)) {
          events.push({
            serviceType: "TDS", type: "TDS", cadence: "QUARTERLY",
            title: `TDS Return (24Q/26Q) — ${q} ${label}`,
            filingPeriod: `${q} ${label}`, dueDate: due, reminderDays: 10,
            description: `Quarterly TDS statement for ${q} ${label}`,
          })
        }
      }
    }

    if (services.has("INCOME_TAX")) {
      // Advance-tax instalments (cumulative 15/45/75/100%).
      const advanceTax = [
        { q: "Q1", due: new Date(fy, 5, 15) },      // Jun 15
        { q: "Q2", due: new Date(fy, 8, 15) },      // Sep 15
        { q: "Q3", due: new Date(fy, 11, 15) },     // Dec 15
        { q: "Q4", due: new Date(fy + 1, 2, 15) },  // Mar 15
      ]
      for (const { q, due } of advanceTax) {
        if (inWindow(due, from, to)) {
          events.push({
            serviceType: "INCOME_TAX", type: "ITR", cadence: "QUARTERLY",
            title: `Advance Tax — ${q} ${label}`,
            filingPeriod: `${q} ${label}`, dueDate: due, reminderDays: 10,
            description: `Advance-tax instalment ${q} for ${label}`,
          })
        }
      }
    }

    // ── Annual cadences (dues fall in the year AFTER the FY starts) ────────
    if (services.has("INCOME_TAX")) {
      const itrDue = isAuditCase
        ? new Date(fy + 1, 9, 31) // Oct 31 — audit cases
        : new Date(fy + 1, 6, 31) // Jul 31 — non-audit
      if (inWindow(itrDue, from, to)) {
        events.push({
          serviceType: "INCOME_TAX", type: "ITR", cadence: "ANNUAL",
          title: isAuditCase
            ? `Income Tax Return (Audit Case) — ${label}`
            : `Income Tax Return — ${label}`,
          filingPeriod: label, dueDate: itrDue, reminderDays: 30,
          description: `ITR filing for ${label}${isAuditCase ? " (audit case — Oct 31)" : " (due Jul 31)"}`,
        })
      }
    }

    if (services.has("AUDIT")) {
      const statAuditDue = new Date(fy + 1, 8, 30) // Sep 30
      if (inWindow(statAuditDue, from, to)) {
        events.push({
          serviceType: "AUDIT", type: "AUDIT", cadence: "ANNUAL",
          title: `Statutory Audit — ${label}`,
          filingPeriod: label, dueDate: statAuditDue, reminderDays: 30,
          description: `Complete statutory audit & sign financials for ${label}`,
        })
      }
      const taxAuditDue = new Date(fy + 1, 8, 30) // Sep 30
      if (inWindow(taxAuditDue, from, to)) {
        events.push({
          serviceType: "AUDIT", type: "AUDIT", cadence: "ANNUAL",
          title: `Tax Audit Report (3CA/3CB-3CD) — ${label}`,
          filingPeriod: label, dueDate: taxAuditDue, reminderDays: 21,
          description: `Upload tax audit report for ${label} (due Sep 30)`,
        })
      }
    }

    if (services.has("COMPANY_LAW")) {
      const rocFilings = [
        { title: `DIR-3 KYC — ${label}`, due: new Date(fy + 1, 8, 30), rem: 15,
          desc: `Director KYC for ${label} (due Sep 30)` },
        { title: `AOC-4 (Financial Statements) — ${label}`, due: new Date(fy + 1, 9, 30), rem: 30,
          desc: `File financial statements for ${label} (AGM Sep 30 + 30 days)` },
        { title: `MGT-7 (Annual Return) — ${label}`, due: new Date(fy + 1, 10, 28), rem: 30,
          desc: `File annual return for ${label} (AGM Sep 30 + 60 days)` },
      ]
      for (const f of rocFilings) {
        if (inWindow(f.due, from, to)) {
          events.push({
            serviceType: "COMPANY_LAW", type: "ROC", cadence: "ANNUAL",
            title: f.title, filingPeriod: label, dueDate: f.due,
            reminderDays: f.rem, description: f.desc,
          })
        }
      }
    }
  }

  events.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  return events
}

/**
 * The window the per-client generator uses: backfill from the start of the
 * current FY (past dues become OVERDUE work items) through every annual
 * filing for the current FY (the last is MGT-7 on Nov 28 of the following
 * year). Monthly cadences are capped ~13 months out so the calendar isn't
 * flooded with far-future rows — the monthly cron tops those up with a
 * rolling lead window.
 */
export function clientGenerationWindow(now: Date): {
  from: Date
  to: Date
  monthlyCap: Date
} {
  const fy = fyStartYear(now)
  const from = new Date(fy, 3, 1)
  return {
    from,
    to: addMonths(from, 21),        // covers MGT-7 (Nov 28, fy+1)
    monthlyCap: addMonths(from, 13), // monthly periods Apr..Mar (dues May..Apr)
  }
}

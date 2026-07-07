/**
 * Build a Schedule III (Division I) P&L and Balance Sheet from mapped
 * trial-balance ledgers. Pure functions, no I/O.
 *
 * Sign convention: `net = debit − credit` per ledger.
 *  - ASSET / EXPENSE buckets display `net` (debit-positive)
 *  - LIABILITY / INCOME buckets display `−net` (credit-positive)
 * A negative display amount means the ledger sits on the unusual side
 * (e.g. a bank ledger with an overdraft balance) — shown, not hidden.
 *
 * Because every ledger lands in exactly one bucket and the year's profit is
 * added to Reserves & surplus, the Balance Sheet balances whenever the trial
 * balance itself balances.
 */

import { BUCKETS, classifyLedger, type BucketKey } from "./buckets"

export type MappedLedger = {
  name: string
  group?: string | null
  debit: number
  credit: number
  bucket: BucketKey
  /** false when the bucket came from the side-default, not a keyword rule */
  matched: boolean
}

export type StatementLine = {
  bucket: BucketKey
  label: string
  amount: number
  ledgers: Array<{ name: string; amount: number }>
}

export type StatementSection = {
  title: string
  lines: StatementLine[]
  total: number
}

export type Statements = {
  pl: {
    income: StatementSection
    expenses: StatementSection
    profitBeforeTax: number
  }
  bs: {
    equityAndLiabilities: StatementSection[]
    assets: StatementSection[]
    totalEquityAndLiabilities: number
    totalAssets: number
  }
  checks: {
    tbBalanced: boolean
    /** debits − credits across the whole TB (₹) */
    tbDifference: number
    bsBalanced: boolean
    unmatchedCount: number
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Parse an amount cell: strips ₹/commas, treats "1,234.50 Dr"/"Cr" suffixes. */
export function parseTbAmount(raw: string): number {
  const s = raw.trim()
  if (!s) return 0
  const cleaned = s.replace(/[₹,\s]/g, "").replace(/(dr|cr)\.?$/i, "")
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  return /cr\.?$/i.test(s) ? -Math.abs(n) : n
}

/** Auto-classify raw TB rows into MappedLedgers (user can re-map in the UI). */
export function autoMapLedgers(
  rows: Array<{ name: string; group?: string | null; debit: number; credit: number }>
): MappedLedger[] {
  return rows
    .filter((r) => r.name.trim() && (r.debit !== 0 || r.credit !== 0))
    .map((r) => {
      const net = r.debit - r.credit
      const { bucket, matched } = classifyLedger(r.name, { group: r.group, netAmount: net })
      return { ...r, bucket, matched }
    })
}

function buildLine(bucket: BucketKey, ledgers: MappedLedger[]): StatementLine {
  const side = BUCKETS[bucket].side
  const signed = (l: MappedLedger) => {
    const net = l.debit - l.credit
    return side === "ASSET" || side === "EXPENSE" ? net : -net
  }
  const rows = ledgers.filter((l) => l.bucket === bucket)
  return {
    bucket,
    label: BUCKETS[bucket].label,
    amount: r2(rows.reduce((s, l) => s + signed(l), 0)),
    ledgers: rows
      .map((l) => ({ name: l.name, amount: r2(signed(l)) }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  }
}

function section(title: string, buckets: BucketKey[], ledgers: MappedLedger[]): StatementSection {
  const lines = buckets.map((b) => buildLine(b, ledgers)).filter((l) => l.ledgers.length > 0)
  return { title, lines, total: r2(lines.reduce((s, l) => s + l.amount, 0)) }
}

export function buildStatements(ledgers: MappedLedger[]): Statements {
  // ── P&L ────────────────────────────────────────────────────────────────────
  const income = section("Income", ["REVENUE", "OTHER_INCOME"], ledgers)
  const expenses = section(
    "Expenses",
    ["OPENING_STOCK", "PURCHASES", "DIRECT_EXPENSES", "EMPLOYEE_COSTS", "FINANCE_COSTS", "DEPRECIATION", "OTHER_EXPENSES"],
    ledgers
  )
  const profitBeforeTax = r2(income.total - expenses.total)

  // ── Balance sheet ──────────────────────────────────────────────────────────
  const shareholders = section("Shareholders' funds", ["CAPITAL", "RESERVES"], ledgers)
  // Current-year profit flows into Reserves & surplus
  if (profitBeforeTax !== 0) {
    let reserves = shareholders.lines.find((l) => l.bucket === "RESERVES")
    if (!reserves) {
      reserves = { bucket: "RESERVES", label: BUCKETS.RESERVES.label, amount: 0, ledgers: [] }
      shareholders.lines.push(reserves)
    }
    reserves.ledgers.push({
      name: profitBeforeTax >= 0 ? "Add: Profit for the year (from P&L)" : "Less: Loss for the year (from P&L)",
      amount: profitBeforeTax,
    })
    reserves.amount = r2(reserves.amount + profitBeforeTax)
    shareholders.total = r2(shareholders.total + profitBeforeTax)
  }

  const nonCurrentLiab = section("Non-current liabilities", ["LT_BORROWINGS", "LT_PROVISIONS"], ledgers)
  const currentLiab = section(
    "Current liabilities",
    ["ST_BORROWINGS", "TRADE_PAYABLES", "OTHER_CURRENT_LIABILITIES", "ST_PROVISIONS"],
    ledgers
  )
  const nonCurrentAssets = section(
    "Non-current assets",
    ["FIXED_ASSETS", "INTANGIBLES", "LT_INVESTMENTS", "LT_LOANS_ADVANCES"],
    ledgers
  )
  const currentAssets = section(
    "Current assets",
    ["INVENTORIES", "TRADE_RECEIVABLES", "CASH_BANK", "ST_LOANS_ADVANCES", "OTHER_CURRENT_ASSETS"],
    ledgers
  )

  const equityAndLiabilities = [shareholders, nonCurrentLiab, currentLiab].filter(
    (s) => s.lines.length > 0
  )
  const assets = [nonCurrentAssets, currentAssets].filter((s) => s.lines.length > 0)

  const totalEL = r2(equityAndLiabilities.reduce((s, x) => s + x.total, 0))
  const totalAssets = r2(assets.reduce((s, x) => s + x.total, 0))

  // ── Checks ─────────────────────────────────────────────────────────────────
  const tbDifference = r2(ledgers.reduce((s, l) => s + (l.debit - l.credit), 0))

  return {
    pl: { income, expenses, profitBeforeTax },
    bs: {
      equityAndLiabilities,
      assets,
      totalEquityAndLiabilities: totalEL,
      totalAssets,
    },
    checks: {
      tbBalanced: Math.abs(tbDifference) < 1,
      tbDifference,
      bsBalanced: Math.abs(totalAssets - totalEL) < 1,
      unmatchedCount: ledgers.filter((l) => !l.matched).length,
    },
  }
}

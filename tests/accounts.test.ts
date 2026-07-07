/**
 * Financial-statements engine tests — ledger classification, P&L/BS assembly,
 * and the balance-by-construction invariant, against a hand-balanced TB.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { classifyLedger } from "@/lib/accounts/buckets"
import { autoMapLedgers, buildStatements, parseTbAmount } from "@/lib/accounts/statements"

// ─── Hand-balanced synthetic trial balance (debits = credits = ₹21,00,000) ───

const TB: Array<{ name: string; debit: number; credit: number }> = [
  // Credits
  { name: "Capital Account", debit: 0, credit: 5_00_000 },
  { name: "Term Loan from HDFC", debit: 0, credit: 2_00_000 },
  { name: "Sundry Creditors", debit: 0, credit: 1_50_000 },
  { name: "GST Payable", debit: 0, credit: 30_000 },
  { name: "Sales", debit: 0, credit: 12_00_000 },
  { name: "Interest Received", debit: 0, credit: 20_000 },
  // Debits
  { name: "Furniture & Fixtures", debit: 1_50_000, credit: 0 },
  { name: "Computer & Laptops", debit: 1_00_000, credit: 0 },
  { name: "Sundry Debtors", debit: 2_80_000, credit: 0 },
  { name: "Cash in Hand", debit: 20_000, credit: 0 },
  { name: "HDFC Bank", debit: 1_80_000, credit: 0 },
  { name: "GST Input Credit", debit: 40_000, credit: 0 },
  { name: "Advance Tax Paid", debit: 60_000, credit: 0 },
  { name: "Purchases", debit: 7_00_000, credit: 0 },
  { name: "Salaries", debit: 2_40_000, credit: 0 },
  { name: "Rent Paid", debit: 1_20_000, credit: 0 },
  { name: "Electricity Charges", debit: 50_000, credit: 0 },
  { name: "Bank Charges", debit: 5_000, credit: 0 },
  { name: "Depreciation", debit: 45_000, credit: 0 },
  { name: "Opening Stock", debit: 1_00_000, credit: 0 },
  { name: "Mystery Suspense Ledger", debit: 10_000, credit: 0 },
]

describe("classifyLedger — Indian ledger-name conventions", () => {
  const cases: Array<[string, number, string]> = [
    ["Interest Received", -20_000, "OTHER_INCOME"], // not FINANCE_COSTS / REVENUE
    ["GST Payable", -30_000, "OTHER_CURRENT_LIABILITIES"], // not TRADE_PAYABLES
    ["Opening Stock", 1_00_000, "OPENING_STOCK"], // not INVENTORIES
    ["Bank Charges", 5_000, "FINANCE_COSTS"], // not CASH_BANK
    ["HDFC Bank", 1_80_000, "CASH_BANK"],
    ["Sundry Debtors", 2_80_000, "TRADE_RECEIVABLES"],
    ["Sundry Creditors", -1_50_000, "TRADE_PAYABLES"],
    ["Term Loan from HDFC", -2_00_000, "LT_BORROWINGS"],
    ["GST Input Credit", 40_000, "ST_LOANS_ADVANCES"],
    ["Advance Tax Paid", 60_000, "ST_LOANS_ADVANCES"],
    ["Rent Paid", 1_20_000, "OTHER_EXPENSES"],
    ["Rent Received", -60_000, "OTHER_INCOME"],
    ["Capital Account", -5_00_000, "CAPITAL"],
  ]
  for (const [name, net, expected] of cases) {
    test(`${name} → ${expected}`, () => {
      const r = classifyLedger(name, { netAmount: net })
      assert.equal(r.bucket, expected)
      assert.equal(r.matched, true)
    })
  }

  test("unknown ledger side-defaults to the balance sheet, flagged for review", () => {
    const dr = classifyLedger("Mystery Suspense Ledger", { netAmount: 10_000 })
    assert.equal(dr.bucket, "OTHER_CURRENT_ASSETS")
    assert.equal(dr.matched, false)
    const cr = classifyLedger("Random Unknown Thing", { netAmount: -5_000 })
    assert.equal(cr.bucket, "OTHER_CURRENT_LIABILITIES")
  })
})

describe("parseTbAmount", () => {
  test("Indian formats, symbols, Dr/Cr suffixes", () => {
    assert.equal(parseTbAmount("1,23,456.78"), 123456.78)
    assert.equal(parseTbAmount("₹5,000"), 5000)
    assert.equal(parseTbAmount("2,500 Cr"), -2500)
    assert.equal(parseTbAmount("2,500 Dr"), 2500)
    assert.equal(parseTbAmount(""), 0)
    assert.equal(parseTbAmount("garbage"), 0)
  })
})

describe("buildStatements — balanced TB", () => {
  const mapped = autoMapLedgers(TB)
  const s = buildStatements(mapped)

  test("TB is recognised as balanced", () => {
    assert.equal(s.checks.tbBalanced, true)
    assert.equal(s.checks.tbDifference, 0)
  })

  test("P&L totals", () => {
    assert.equal(s.pl.income.total, 12_20_000)
    assert.equal(s.pl.expenses.total, 12_60_000) // 1L stock +7L purchases +2.4L staff +5k finance +45k dep +1.7L other
    assert.equal(s.pl.profitBeforeTax, -40_000) // a loss year
  })

  test("loss flows into Reserves & surplus as a negative", () => {
    const shf = s.bs.equityAndLiabilities.find((x) => x.title === "Shareholders' funds")!
    const reserves = shf.lines.find((l) => l.bucket === "RESERVES")!
    assert.equal(reserves.amount, -40_000)
    assert.ok(reserves.ledgers.some((l) => l.name.startsWith("Less: Loss")))
    assert.equal(shf.total, 4_60_000) // 5L capital − 40k loss
  })

  test("balance sheet balances by construction", () => {
    assert.equal(s.bs.totalAssets, 8_40_000)
    assert.equal(s.bs.totalEquityAndLiabilities, 8_40_000)
    assert.equal(s.checks.bsBalanced, true)
  })

  test("unmatched ledgers are counted for the review banner", () => {
    assert.equal(s.checks.unmatchedCount, 1) // the suspense ledger
  })

  test("line drill-down keeps per-ledger amounts", () => {
    const cash = s.bs.assets
      .flatMap((x) => x.lines)
      .find((l) => l.bucket === "CASH_BANK")!
    assert.equal(cash.amount, 2_00_000)
    assert.deepEqual(
      cash.ledgers.map((l) => l.name).sort(),
      ["Cash in Hand", "HDFC Bank"].sort()
    )
  })
})

describe("buildStatements — edge cases", () => {
  test("profit year credits Reserves", () => {
    const s = buildStatements(
      autoMapLedgers([
        { name: "Capital Account", debit: 0, credit: 1_00_000 },
        { name: "HDFC Bank", debit: 1_50_000, credit: 0 },
        { name: "Professional Fees Received", debit: 0, credit: 50_000 },
      ])
    )
    assert.equal(s.pl.profitBeforeTax, 50_000)
    assert.equal(s.bs.totalAssets, 1_50_000)
    assert.equal(s.bs.totalEquityAndLiabilities, 1_50_000)
    assert.equal(s.checks.bsBalanced, true)
  })

  test("unbalanced TB is flagged and does not balance", () => {
    const rows = TB.filter((r) => r.name !== "Sales") // knock out 12L of credits
    const s = buildStatements(autoMapLedgers(rows))
    assert.equal(s.checks.tbBalanced, false)
    assert.equal(s.checks.tbDifference, 12_00_000)
    assert.equal(s.checks.bsBalanced, false)
  })

  test("zero-amount and blank rows are dropped", () => {
    const mapped = autoMapLedgers([
      { name: "Empty Ledger", debit: 0, credit: 0 },
      { name: "  ", debit: 100, credit: 0 },
      { name: "Cash", debit: 500, credit: 0 },
    ])
    assert.equal(mapped.length, 1)
    assert.equal(mapped[0].name, "Cash")
  })
})

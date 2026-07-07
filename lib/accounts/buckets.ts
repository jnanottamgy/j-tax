/**
 * Schedule III (Division I) statement buckets + ledger auto-classification.
 *
 * Every trial-balance ledger is assigned to exactly ONE bucket. That single-
 * assignment invariant is what makes the generated Balance Sheet balance by
 * construction: Assets(dr) + Expenses(dr) = Liabilities(cr) + Income(cr)
 * ⇒ Assets = Liabilities + (Income − Expenses) = Liabilities + Profit.
 *
 * Auto-classification is keyword-based (ordered, first match wins) and tuned
 * to Indian ledger-naming conventions (Tally group names included). Anything
 * unrecognised defaults conservatively to the Balance Sheet (other current
 * asset/liability by balance side) and is flagged for review — an unmapped
 * ledger must never silently distort the P&L.
 */

export type BucketKey =
  // Balance sheet — equity & liabilities
  | "CAPITAL"
  | "RESERVES"
  | "LT_BORROWINGS"
  | "LT_PROVISIONS"
  | "ST_BORROWINGS"
  | "TRADE_PAYABLES"
  | "OTHER_CURRENT_LIABILITIES"
  | "ST_PROVISIONS"
  // Balance sheet — assets
  | "FIXED_ASSETS"
  | "INTANGIBLES"
  | "LT_INVESTMENTS"
  | "LT_LOANS_ADVANCES"
  | "INVENTORIES"
  | "TRADE_RECEIVABLES"
  | "CASH_BANK"
  | "ST_LOANS_ADVANCES"
  | "OTHER_CURRENT_ASSETS"
  // Profit & loss
  | "REVENUE"
  | "OTHER_INCOME"
  | "OPENING_STOCK"
  | "PURCHASES"
  | "DIRECT_EXPENSES"
  | "EMPLOYEE_COSTS"
  | "FINANCE_COSTS"
  | "DEPRECIATION"
  | "OTHER_EXPENSES"

export type BucketSide = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE"

export const BUCKETS: Record<BucketKey, { label: string; side: BucketSide }> = {
  CAPITAL: { label: "Share / partners' / proprietor's capital", side: "LIABILITY" },
  RESERVES: { label: "Reserves and surplus", side: "LIABILITY" },
  LT_BORROWINGS: { label: "Long-term borrowings", side: "LIABILITY" },
  LT_PROVISIONS: { label: "Long-term provisions", side: "LIABILITY" },
  ST_BORROWINGS: { label: "Short-term borrowings", side: "LIABILITY" },
  TRADE_PAYABLES: { label: "Trade payables", side: "LIABILITY" },
  OTHER_CURRENT_LIABILITIES: { label: "Other current liabilities", side: "LIABILITY" },
  ST_PROVISIONS: { label: "Short-term provisions", side: "LIABILITY" },
  FIXED_ASSETS: { label: "Property, plant and equipment", side: "ASSET" },
  INTANGIBLES: { label: "Intangible assets", side: "ASSET" },
  LT_INVESTMENTS: { label: "Non-current investments", side: "ASSET" },
  LT_LOANS_ADVANCES: { label: "Long-term loans and advances", side: "ASSET" },
  INVENTORIES: { label: "Inventories", side: "ASSET" },
  TRADE_RECEIVABLES: { label: "Trade receivables", side: "ASSET" },
  CASH_BANK: { label: "Cash and bank balances", side: "ASSET" },
  ST_LOANS_ADVANCES: { label: "Short-term loans and advances", side: "ASSET" },
  OTHER_CURRENT_ASSETS: { label: "Other current assets", side: "ASSET" },
  REVENUE: { label: "Revenue from operations", side: "INCOME" },
  OTHER_INCOME: { label: "Other income", side: "INCOME" },
  OPENING_STOCK: { label: "Changes in inventories (opening stock)", side: "EXPENSE" },
  PURCHASES: { label: "Purchases / cost of materials", side: "EXPENSE" },
  DIRECT_EXPENSES: { label: "Direct expenses", side: "EXPENSE" },
  EMPLOYEE_COSTS: { label: "Employee benefits expense", side: "EXPENSE" },
  FINANCE_COSTS: { label: "Finance costs", side: "EXPENSE" },
  DEPRECIATION: { label: "Depreciation and amortisation", side: "EXPENSE" },
  OTHER_EXPENSES: { label: "Other expenses", side: "EXPENSE" },
}

/**
 * Ordered rules — FIRST match wins, so specific phrases must come before the
 * generic words they contain ("interest received" before "interest",
 * "gst payable" before "payable", "opening stock" before "stock").
 */
const RULES: Array<{ bucket: BucketKey; words: string[] }> = [
  // P&L income (specific credits first)
  { bucket: "OTHER_INCOME", words: ["interest received", "interest income", "discount received", "rent received", "dividend", "misc income", "miscellaneous income", "commission received", "profit on sale"] },
  { bucket: "REVENUE", words: ["sales", "service income", "services rendered", "professional fee", "professional receipts", "fees received", "consultancy", "revenue", "turnover", "gross receipts", "contract receipts", "job work income"] },

  // P&L expenses (specific debits before generic asset words)
  { bucket: "OPENING_STOCK", words: ["opening stock", "opening inventory"] },
  { bucket: "PURCHASES", words: ["purchase"] },
  { bucket: "DEPRECIATION", words: ["depreciation", "amortis", "amortiz"] },
  { bucket: "FINANCE_COSTS", words: ["interest paid", "interest on loan", "interest on od", "interest on cc", "bank charges", "processing fee", "loan processing", "finance charge"] },
  { bucket: "EMPLOYEE_COSTS", words: ["salary", "salaries", "wages", "staff welfare", "bonus", "gratuity", "remuneration", "epf", "pf contribution", "esi", "esic", "staff"] },
  { bucket: "DIRECT_EXPENSES", words: ["freight", "carriage", "cartage", "power and fuel", "factory", "loading", "octroi", "customs duty", "import duty", "job work charges"] },
  { bucket: "OTHER_EXPENSES", words: ["rent paid", "rent expense", "office rent", "electricity", "telephone", "internet", "printing", "stationery", "travelling", "travel", "conveyance", "repairs", "maintenance", "insurance", "audit fee", "legal", "professional charges", "advertisement", "marketing", "commission paid", "discount allowed", "donation", "subscription", "postage", "courier", "office expense", "misc expense", "miscellaneous expense", "general expense", "rates and taxes", "roc fee", "late fee", "penalty", "interest on tds", "interest on gst", "water charges", "security charges", "housekeeping", "software subscription", "loss on sale"] },

  // Balance sheet — liabilities (specific before "payable"/"loan")
  { bucket: "OTHER_CURRENT_LIABILITIES", words: ["gst payable", "output cgst", "output sgst", "output igst", "output tax", "tds payable", "tcs payable", "pt payable", "professional tax payable", "salary payable", "salaries payable", "wages payable", "expenses payable", "audit fee payable", "rent payable", "advance from customer", "advance received", "duties & taxes", "duties and taxes", "statutory dues"] },
  { bucket: "ST_PROVISIONS", words: ["provision for tax", "provision for income tax", "provision"] },
  { bucket: "ST_BORROWINGS", words: ["bank od", "overdraft", "cash credit", "cc account", "cc a/c", "short term loan", "working capital loan"] },
  { bucket: "LT_BORROWINGS", words: ["term loan", "vehicle loan", "car loan", "housing loan", "machinery loan", "loan from", "debenture", "unsecured loan"] },
  { bucket: "TRADE_PAYABLES", words: ["sundry creditor", "creditors", "creditor", "trade payable", "accounts payable", "payable"] },
  { bucket: "RESERVES", words: ["reserve", "surplus", "retained earning", "profit & loss a/c", "profit and loss a/c", "p&l a/c"] },
  { bucket: "CAPITAL", words: ["share capital", "capital account", "capital a/c", "proprietor", "partner's capital", "partners capital", "capital"] },

  // Balance sheet — assets (specific before "cash"/"bank"/"stock")
  { bucket: "ST_LOANS_ADVANCES", words: ["gst input", "input cgst", "input sgst", "input igst", "input tax", "itc", "tds receivable", "tds recoverable", "advance tax", "tcs receivable", "prepaid", "advance to supplier", "advance to staff", "security deposit", "earnest money", "deposit"] },
  { bucket: "INTANGIBLES", words: ["goodwill", "software", "patent", "trademark", "copyright", "licence", "license fee capital"] },
  { bucket: "FIXED_ASSETS", words: ["furniture", "fixture", "plant", "machinery", "vehicle", "motor car", "car a/c", "computer", "laptop", "printer", "equipment", "building", "premises", "land", "air condition", "mobile phone", "fixed asset"] },
  { bucket: "LT_INVESTMENTS", words: ["investment", "fixed deposit", "fd with", "mutual fund", "shares of", "ppf"] },
  { bucket: "INVENTORIES", words: ["closing stock", "stock in hand", "stock-in-trade", "inventory", "stock"] },
  { bucket: "TRADE_RECEIVABLES", words: ["sundry debtor", "debtors", "debtor", "trade receivable", "accounts receivable", "receivable"] },
  { bucket: "CASH_BANK", words: ["cash in hand", "cash-in-hand", "petty cash", "cash", "bank"] },
]

/**
 * Classify a ledger by name (and optional Tally parent group). Returns the
 * bucket plus whether it was rule-matched or side-defaulted (needs review).
 */
export function classifyLedger(
  name: string,
  opts: { group?: string | null; netAmount: number }
): { bucket: BucketKey; matched: boolean } {
  const haystack = `${name} ${opts.group ?? ""}`.toLowerCase()
  for (const rule of RULES) {
    if (rule.words.some((w) => haystack.includes(w))) {
      return { bucket: rule.bucket, matched: true }
    }
  }
  // Conservative default: park on the Balance Sheet by balance side and flag.
  return {
    bucket: opts.netAmount >= 0 ? "OTHER_CURRENT_ASSETS" : "OTHER_CURRENT_LIABILITIES",
    matched: false,
  }
}

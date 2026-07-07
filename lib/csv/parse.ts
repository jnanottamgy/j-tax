/**
 * Dependency-free CSV parse/serialize (RFC 4180-ish).
 *
 * Handles: quoted fields, escaped quotes (""), embedded commas/newlines,
 * CRLF/LF line endings, UTF-8 BOM, and ragged rows (padded to header width).
 * Used by bulk client import/export; later by GSTR/bank-statement imports.
 */

export type ParsedCsv = {
  headers: string[]
  /** Row values aligned to headers (padded/truncated to header count) */
  rows: string[][]
}

export function parseCsv(text: string): ParsedCsv {
  // Strip UTF-8 BOM
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const records: string[][] = []
  let field = ""
  let record: string[] = []
  let inQuotes = false

  const pushField = () => {
    record.push(field)
    field = ""
  }
  const pushRecord = () => {
    pushField()
    // Skip records that are entirely empty (trailing newline, blank lines)
    if (record.length > 1 || record[0].trim() !== "") records.push(record)
    record = []
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++ // escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      pushField()
    } else if (ch === "\n") {
      pushRecord()
    } else if (ch === "\r") {
      if (input[i + 1] === "\n") i++ // CRLF
      pushRecord()
    } else {
      field += ch
    }
  }
  // Final field/record (no trailing newline)
  if (field !== "" || record.length > 0) pushRecord()

  if (records.length === 0) return { headers: [], rows: [] }

  const headers = records[0].map((h) => h.trim())
  const rows = records.slice(1).map((r) => {
    if (r.length === headers.length) return r
    if (r.length > headers.length) return r.slice(0, headers.length)
    return [...r, ...Array(headers.length - r.length).fill("")]
  })
  return { headers, rows }
}

/** Parse and return rows as objects keyed by header. */
export function parseCsvObjects(text: string): Array<Record<string, string>> {
  const { headers, rows } = parseCsv(text)
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))
  )
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Serialize rows to CSV text (CRLF, per RFC 4180). */
export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const head = headers.map(escapeCsvField).join(",")
  const body = rows.map((r) =>
    headers.map((_, i) => escapeCsvField(String(r[i] ?? ""))).join(",")
  )
  return [head, ...body].join("\r\n")
}

// Data import functionality for commercial readiness

export interface ImportOptions {
  format: "csv" | "json"
  entityType: "clients" | "tasks" | "invoices" | "employees"
  data: string
  skipDuplicates: boolean
  updateExisting: boolean
}

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  failed: number
  errors: Array<{ row: number; error: string }>
}

export async function importData(options: ImportOptions): Promise<ImportResult> {
  try {
    let parsedData: any[]

    switch (options.format) {
      case "csv":
        parsedData = parseCSV(options.data)
        break
      case "json":
        parsedData = JSON.parse(options.data)
        break
      default:
        return { success: false, imported: 0, skipped: 0, failed: 0, errors: [] }
    }

    let result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }

    switch (options.entityType) {
      case "clients":
        result = await importClients(parsedData, options)
        break
      case "tasks":
        result = await importTasks(parsedData, options)
        break
      case "invoices":
        result = await importInvoices(parsedData, options)
        break
      case "employees":
        result = await importEmployees(parsedData, options)
        break
      default:
        return { success: false, imported: 0, skipped: 0, failed: 0, errors: [] }
    }

    return result
  } catch (error) {
    console.error("Import failed:", error)
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [{ row: 0, error: error instanceof Error ? error.message : "Import failed" }],
    }
  }
}

function parseCSV(csv: string): any[] {
  const lines = csv.split("\n").filter((line) => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
  const data: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""))
    const row: any = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })

    data.push(row)
  }

  return data
}

async function importClients(data: any[], options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // Placeholder: In production, import to database
  for (let i = 0; i < data.length; i++) {
    try {
      const client = data[i]
      
      // Validate required fields
      if (!client.name || !client.code) {
        result.failed++
        result.errors.push({ row: i + 1, error: "Missing required fields: name, code" })
        continue
      }

      // Check for duplicates
      if (options.skipDuplicates) {
        // Placeholder: Check if client exists
        // const existing = await prisma.client.findUnique({ where: { clientCode: client.code } })
        // if (existing) {
        //   result.skipped++
        //   continue
        // }
      }

      // Import client
      // await prisma.client.create({ data: client })
      result.imported++
    } catch (error) {
      result.failed++
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : "Import failed",
      })
    }
  }

  return result
}

async function importTasks(data: any[], options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // Placeholder: In production, import to database
  for (let i = 0; i < data.length; i++) {
    try {
      const task = data[i]
      
      if (!task.title || !task.clientId) {
        result.failed++
        result.errors.push({ row: i + 1, error: "Missing required fields: title, clientId" })
        continue
      }

      // Import task
      result.imported++
    } catch (error) {
      result.failed++
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : "Import failed",
      })
    }
  }

  return result
}

async function importInvoices(data: any[], options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // Placeholder: In production, import to database
  for (let i = 0; i < data.length; i++) {
    try {
      const invoice = data[i]
      
      if (!invoice.invoiceNumber || !invoice.clientId || !invoice.amount) {
        result.failed++
        result.errors.push({
          row: i + 1,
          error: "Missing required fields: invoiceNumber, clientId, amount",
        })
        continue
      }

      // Import invoice
      result.imported++
    } catch (error) {
      result.failed++
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : "Import failed",
      })
    }
  }

  return result
}

async function importEmployees(data: any[], options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  // Placeholder: In production, import to database
  for (let i = 0; i < data.length; i++) {
    try {
      const employee = data[i]
      
      if (!employee.name || !employee.email) {
        result.failed++
        result.errors.push({ row: i + 1, error: "Missing required fields: name, email" })
        continue
      }

      // Import employee
      result.imported++
    } catch (error) {
      result.failed++
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : "Import failed",
      })
    }
  }

  return result
}

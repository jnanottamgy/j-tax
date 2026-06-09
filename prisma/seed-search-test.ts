import { config } from "dotenv"
import { prisma } from "../lib/prisma"

config()

async function main() {
  console.log("=".repeat(80))
  console.log("SEEDING SEARCH TEST DATA (1000 RECORDS)")
  console.log("=".repeat(80))
  console.log()

  // Generate 200 clients
  console.log("Creating 200 clients...")
  const clients = []
  for (let i = 1; i <= 200; i++) {
    const client = await prisma.client.create({
      data: {
        clientCode: `CLT-${String(i).padStart(6, "0")}`,
        name: `Test Client ${i}`,
        gstin: `27ABCDE${String(i).padStart(5, "0")}Z1`,
        pan: `ABCDE${String(i).padStart(4, "0")}C`,
        email: `client${i}@test.com`,
        phone: `9876543${String(i).padStart(3, "0")}`,
        address: `Test Address ${i}, Test City`,
        status: "ACTIVE",
        priority: i % 3 === 0 ? "HIGH" : i % 2 === 0 ? "MEDIUM" : "LOW",
      },
    })
    clients.push(client)
  }
  console.log(`✅ Created ${clients.length} clients`)
  console.log()

  // Generate 50 employees
  console.log("Creating 50 employees...")
  const employees = []
  const departments = ["Tax Advisory", "Compliance", "Partnership", "Operations", "Audit"]
  for (let i = 1; i <= 50; i++) {
    const employee = await prisma.employee.create({
      data: {
        name: `Test Employee ${i}`,
        email: `employee${i}@test.com`,
        department: departments[i % departments.length],
        isActive: true,
      },
    })
    employees.push(employee)
  }
  console.log(`✅ Created ${employees.length} employees`)
  console.log()

  // Generate 300 tasks
  console.log("Creating 300 tasks...")
  const tasks = []
  const taskTitles = [
    "GST Return Filing",
    "Income Tax Return",
    "TDS Return",
    "ROC Filing",
    "Audit Preparation",
    "Balance Sheet",
    "P&L Statement",
    "Tax Planning",
    "Compliance Review",
    "Document Verification",
  ]
  for (let i = 1; i <= 300; i++) {
    const client = clients[i % clients.length]
    const employee = employees[i % employees.length]
    const task = await prisma.task.create({
      data: {
        title: `${taskTitles[i % taskTitles.length]} - ${i}`,
        description: `Test task description ${i} for search testing`,
        clientId: client.id,
        assignedEmployeeId: employee.id,
        status: i % 4 === 0 ? "FILED_DONE" : "IN_PROGRESS",
        dueDate: new Date(Date.now() + i * 86400000),
        priority: i % 3 === 0 ? "HIGH" : i % 2 === 0 ? "MEDIUM" : "LOW",
      },
    })
    tasks.push(task)
  }
  console.log(`✅ Created ${tasks.length} tasks`)
  console.log()

  // Generate 200 invoices
  console.log("Creating 200 invoices...")
  const invoices = []
  for (let i = 1; i <= 200; i++) {
    const client = clients[i % clients.length]
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${String(i).padStart(6, "0")}`,
        clientId: client.id,
        amount: 10000 + i * 100,
        paidAmount: i % 3 === 0 ? 0 : 5000 + i * 50,
        outstandingAmount: i % 3 === 0 ? 10000 + i * 100 : 5000 + i * 50,
        issueDate: new Date(Date.now() - i * 86400000),
        dueDate: new Date(Date.now() + (30 - i) * 86400000),
        status: i % 3 === 0 ? "SENT" : i % 2 === 0 ? "PARTIALLY_PAID" : "PAID",
      },
    })
    invoices.push(invoice)
  }
  console.log(`✅ Created ${invoices.length} invoices`)
  console.log()

  // Generate 250 documents
  console.log("Creating 250 documents...")
  const documents = []
  const documentCategories: Array<"GST" | "TDS" | "ROC" | "AUDIT" | "INCOME_TAX" | "PAYROLL" | "BANK_STATEMENTS" | "INVOICES" | "AGREEMENTS" | "OTHER"> = ["GST", "TDS", "ROC", "AUDIT", "INCOME_TAX", "PAYROLL", "OTHER"]
  for (let i = 1; i <= 250; i++) {
    const client = clients[i % clients.length]
    const document = await prisma.document.create({
      data: {
        clientId: client.id,
        title: `Test Document ${i} - ${documentCategories[i % documentCategories.length]}`,
        description: `Test document description ${i} for search testing`,
        category: documentCategories[i % documentCategories.length],
        fileName: `document_${i}.pdf`,
        fileSize: 1024 * 100 + i * 1000,
        fileType: "application/pdf",
        storagePath: `documents/${client.id}/doc_${i}.pdf`,
        uploadedBy: employees[i % employees.length].id,
        isConfidential: i % 5 === 0,
      },
    })
    documents.push(document)
  }
  console.log(`✅ Created ${documents.length} documents`)
  console.log()

  console.log("=".repeat(80))
  console.log("SEEDING COMPLETE")
  console.log("=".repeat(80))
  console.log()
  console.log("Summary:")
  console.log(`  Clients: ${clients.length}`)
  console.log(`  Employees: ${employees.length}`)
  console.log(`  Tasks: ${tasks.length}`)
  console.log(`  Invoices: ${invoices.length}`)
  console.log(`  Documents: ${documents.length}`)
  console.log(`  Total: ${clients.length + employees.length + tasks.length + invoices.length + documents.length}`)
}

main()
  .then(() => {
    console.log("\n✅ Seeding completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Seeding failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

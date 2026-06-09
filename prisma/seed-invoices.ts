import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
import { config } from "dotenv"

// Load environment variables from .env file
config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Starting invoice seeding...")

  // Get existing clients
  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
  })

  if (clients.length === 0) {
    console.error("No active clients found. Please create clients first.")
    return
  }

  console.log(`Found ${clients.length} active clients`)

  // Clear existing invoices
  await prisma.paymentReceipt.deleteMany({})
  await prisma.followUp.deleteMany({})
  await prisma.invoiceReminder.deleteMany({})
  await prisma.invoice.deleteMany({})
  console.log("Cleared existing invoices")

  const statuses: Array<"DRAFT" | "SENT" | "PAID" | "PARTIALLY_PAID" | "OVERDUE"> = [
    "DRAFT",
    "SENT",
    "PAID",
    "PARTIALLY_PAID",
    "OVERDUE",
  ]

  const now = new Date()
  const invoices = []

  // Create 100 invoices with various scenarios
  for (let i = 1; i <= 100; i++) {
    const client = clients[Math.floor(Math.random() * clients.length)]
    const amount = Math.floor(Math.random() * 50000) + 5000 // 5000 to 55000
    const invoiceNumber = `INV-${2024}-${String(i).padStart(4, "0")}`
    
    // Calculate dates for different scenarios
    const daysOffset = Math.floor(Math.random() * 60) - 30 // -30 to +30 days
    const issueDate = new Date(now)
    issueDate.setDate(issueDate.getDate() - Math.floor(Math.random() * 30))
    
    const dueDate = new Date(issueDate)
    dueDate.setDate(dueDate.getDate() + 30) // 30-day payment terms

    // Determine status based on dates
    let status: "DRAFT" | "SENT" | "PAID" | "PARTIALLY_PAID" | "OVERDUE"
    let paidAmount = 0
    let outstandingAmount = amount

    const isOverdue = dueDate < now
    const randomStatus = Math.random()

    if (randomStatus < 0.2) {
      status = "DRAFT"
    } else if (randomStatus < 0.4) {
      status = "SENT"
    } else if (randomStatus < 0.6) {
      status = "PAID"
      paidAmount = amount
      outstandingAmount = 0
    } else if (randomStatus < 0.8) {
      status = "PARTIALLY_PAID"
      paidAmount = amount * (0.3 + Math.random() * 0.4) // 30-70% paid
      outstandingAmount = amount - paidAmount
    } else {
      status = isOverdue ? "OVERDUE" : "SENT"
    }

    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        amount,
        paidAmount,
        outstandingAmount,
        status,
        issueDate,
        dueDate,
      },
    })

    invoices.push(invoice)

    // Create payment receipts for paid/partially paid invoices
    if (status === "PAID" || status === "PARTIALLY_PAID") {
      if (status === "PAID") {
        // Full payment - could be single or multiple payments
        if (Math.random() > 0.5) {
          // Single payment
          await prisma.paymentReceipt.create({
            data: {
              invoiceId: invoice.id,
              amount,
              paymentDate: new Date(dueDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
              method: ["Bank Transfer", "UPI", "Cash", "NEFT"][Math.floor(Math.random() * 4)],
              reference: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            },
          })
        } else {
          // Multiple payments
          const numPayments = Math.floor(Math.random() * 3) + 2 // 2-4 payments
          const paymentAmount = amount / numPayments
          for (let j = 0; j < numPayments; j++) {
            await prisma.paymentReceipt.create({
              data: {
                invoiceId: invoice.id,
                amount: paymentAmount,
                paymentDate: new Date(dueDate.getTime() - (numPayments - j) * 7 * 24 * 60 * 60 * 1000),
                method: ["Bank Transfer", "UPI", "Cash", "NEFT"][Math.floor(Math.random() * 4)],
                reference: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
              },
            })
          }
        }
      } else {
        // Partial payment
        await prisma.paymentReceipt.create({
          data: {
            invoiceId: invoice.id,
            amount: paidAmount,
            paymentDate: new Date(dueDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            method: ["Bank Transfer", "UPI", "Cash", "NEFT"][Math.floor(Math.random() * 4)],
            reference: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          },
        })
      }
    }

    // Create follow-ups for overdue/partially paid invoices
    if ((status === "OVERDUE" || status === "PARTIALLY_PAID") && Math.random() > 0.5) {
      const numFollowUps = Math.floor(Math.random() * 3) + 1
      for (let j = 0; j < numFollowUps; j++) {
        await prisma.followUp.create({
          data: {
            invoiceId: invoice.id,
            notes: [
              "Called client - promised to pay by end of week",
              "Sent payment reminder via email",
              "Client requested extension",
              "Scheduled follow-up call",
            ][Math.floor(Math.random() * 4)],
            date: new Date(now.getTime() - (numFollowUps - j) * 5 * 24 * 60 * 60 * 1000),
            followUpBy: ["Admin", "Manager", "Partner"][Math.floor(Math.random() * 3)],
          },
        })
      }
    }

    // Create reminders for sent/overdue invoices
    if (status === "SENT" || status === "OVERDUE") {
      await prisma.invoiceReminder.create({
        data: {
          invoiceId: invoice.id,
          type: status === "OVERDUE" ? "AFTER_DUE" : "BEFORE_DUE",
          scheduledFor: new Date(dueDate.getTime() - (status === "SENT" ? 3 : -1) * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      })
    }

    if (i % 10 === 0) {
      console.log(`Created ${i} invoices...`)
    }
  }

  console.log(`Successfully created ${invoices.length} invoices`)

  // Print summary
  const summary = await prisma.invoice.groupBy({
    by: ["status"],
    _count: true,
    _sum: {
      amount: true,
      outstandingAmount: true,
    },
  })

  console.log("\nInvoice Summary:")
  for (const row of summary) {
    console.log(
      `${row.status}: ${row._count} invoices, Total: ₹${Number(row._sum.amount || 0).toLocaleString("en-IN")}, Outstanding: ₹${Number(row._sum.outstandingAmount || 0).toLocaleString("en-IN")}`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

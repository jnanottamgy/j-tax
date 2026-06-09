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
  console.log("Starting overdue invoice update...")

  const now = new Date()

  // Find all invoices that are:
  // 1. Not already OVERDUE, PAID, WAIVED, or DISPUTED
  // 2. Have a due date in the past
  // 3. Have outstanding amount > 0
  const invoicesToUpdate = await prisma.invoice.findMany({
    where: {
      status: {
        in: ["DRAFT", "SENT", "PARTIALLY_PAID"],
      },
      dueDate: {
        lt: now,
      },
      outstandingAmount: {
        gt: 0,
      },
    },
    include: {
      client: {
        select: {
          name: true,
        },
      },
    },
  })

  console.log(`Found ${invoicesToUpdate.length} invoices to update to OVERDUE`)

  if (invoicesToUpdate.length === 0) {
    console.log("No invoices need to be updated.")
    return
  }

  // Update all found invoices to OVERDUE status
  const updateResult = await prisma.invoice.updateMany({
    where: {
      id: {
        in: invoicesToUpdate.map((inv) => inv.id),
      },
    },
    data: {
      status: "OVERDUE",
    },
  })

  console.log(`Updated ${updateResult.count} invoices to OVERDUE status`)

  // Print summary
  console.log("\nUpdated Invoices:")
  for (const invoice of invoicesToUpdate) {
    console.log(
      `- ${invoice.invoiceNumber}: ${invoice.client.name || "Unknown"} - ₹${Number(invoice.outstandingAmount).toLocaleString("en-IN")} outstanding (Due: ${new Date(invoice.dueDate).toLocaleDateString("en-IN")})`
    )
  }
}

main()
  .catch((e) => {
    console.error("Error updating overdue invoices:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

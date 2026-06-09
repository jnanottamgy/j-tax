import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
import { config } from "dotenv"
import { subDays, subHours, subMinutes } from "date-fns"

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
  console.log("Starting notification seeding...")

  // Get existing users
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
  })

  if (users.length === 0) {
    console.error("No users found. Please create users first.")
    return
  }

  console.log(`Found ${users.length} users`)

  // Clear existing notifications
  await prisma.notification.deleteMany({})
  console.log("Cleared existing notifications")

  const notificationTypes = [
    "TASK_ASSIGNED",
    "TASK_OVERDUE",
    "COMPLIANCE_DUE",
    "PAYMENT_RECEIVED",
    "INVOICE_OVERDUE",
    "DOCUMENT_UPLOADED",
    "INFO",
    "WARNING",
    "ALERT",
  ] as const

  const entityTypes = ["TASK", "COMPLIANCE", "INVOICE", "PAYMENT", "DOCUMENT", "CLIENT", "USER"] as const

  const notifications = []

  // Create 500 notifications
  for (let i = 0; i < 500; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)]
    const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)]
    
    // Random read status (70% unread, 30% read)
    const read = Math.random() > 0.7
    
    // Random archived status (10% archived)
    const archived = Math.random() > 0.9
    
    // Random creation time (last 30 days)
    const daysAgo = Math.floor(Math.random() * 30)
    const hoursAgo = Math.floor(Math.random() * 24)
    const minutesAgo = Math.floor(Math.random() * 60)
    const createdAt = subDays(subHours(subMinutes(new Date(), minutesAgo), hoursAgo), daysAgo)

    let title = ""
    let message = ""
    let actionType = ""

    // Generate realistic notification content based on type
    switch (type) {
      case "TASK_ASSIGNED":
        title = "New Task Assigned"
        message = `You've been assigned to task #${Math.floor(Math.random() * 1000)} for client ${["TechCorp", "FinanceHub", "RetailMax", "ManufacturingPro"][Math.floor(Math.random() * 4)]}`
        actionType = "ASSIGNED"
        break
      case "TASK_OVERDUE":
        title = "Task Overdue"
        message = `Task #${Math.floor(Math.random() * 1000)} is ${Math.floor(Math.random() * 10) + 1} day(s) overdue`
        actionType = "OVERDUE"
        break
      case "COMPLIANCE_DUE":
        title = "Compliance Due"
        message = `${["GSTR-1", "GSTR-3B", "TDS", "ITR", "ROC"][Math.floor(Math.random() * 5)]} filing due in ${Math.floor(Math.random() * 7) + 1} day(s)`
        actionType = "DUE"
        break
      case "PAYMENT_RECEIVED":
        title = "Payment Received"
        message = `Received ₹${(Math.random() * 100000 + 5000).toFixed(0)} from ${["Client A", "Client B", "Client C"][Math.floor(Math.random() * 3)]}`
        actionType = "RECEIVED"
        break
      case "INVOICE_OVERDUE":
        title = "Invoice Overdue"
        message = `Invoice #INV-${2024}-${String(Math.floor(Math.random() * 1000)).padStart(4, "0")} is overdue`
        actionType = "OVERDUE"
        break
      case "DOCUMENT_UPLOADED":
        title = "Document Uploaded"
        message = `${["Invoice", "Agreement", "Report", "Statement"][Math.floor(Math.random() * 4)]} uploaded for ${["Client A", "Client B", "Client C"][Math.floor(Math.random() * 3)]}`
        actionType = "UPLOADED"
        break
      case "INFO":
        title = "System Update"
        message = "A new feature has been added to the system"
        actionType = "INFO"
        break
      case "WARNING":
        title = "Attention Required"
        message = "Please review the pending items in your dashboard"
        actionType = "WARNING"
        break
      case "ALERT":
        title = "Urgent Action Required"
        message = "Immediate attention needed for critical compliance deadline"
        actionType = "ALERT"
        break
    }

    notifications.push({
      userId: user.id,
      title,
      message,
      type: type as any,
      entityType: entityType as any,
      entityId: `entity-${i}`,
      actionType,
      read,
      archived,
      createdAt,
    })

    if (i % 50 === 0) {
      console.log(`Generated ${i} notifications...`)
    }
  }

  await prisma.notification.createMany({
    data: notifications,
  })

  console.log(`Successfully created ${notifications.length} notifications`)

  // Print summary
  const [totalCount, unreadCount, archivedCount, byType, byUser] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { read: false, archived: false } }),
    prisma.notification.count({ where: { archived: true } }),
    prisma.notification.groupBy({
      by: ["type"],
      _count: true,
    }),
    prisma.notification.groupBy({
      by: ["userId"],
      _count: true,
    }),
  ])

  console.log("\nSummary:")
  console.log(`Total notifications: ${totalCount}`)
  console.log(`Unread notifications: ${unreadCount}`)
  console.log(`Archived notifications: ${archivedCount}`)
  console.log("\nNotifications by type:")
  for (const row of byType) {
    console.log(`  ${row.type}: ${row._count}`)
  }
  console.log("\nNotifications by user:")
  for (const row of byUser) {
    console.log(`  User ${row.userId}: ${row._count}`)
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

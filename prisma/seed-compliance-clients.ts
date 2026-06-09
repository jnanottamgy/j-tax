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
  console.log("Starting compliance client seeding...")

  // Get existing employees for assignment
  const employees = await prisma.employee.findMany({
    select: { id: true, name: true },
  })

  if (employees.length === 0) {
    console.error("No employees found. Please create employees first.")
    return
  }

  console.log(`Found ${employees.length} employees`)

  // Clear existing clients and compliance data
  await prisma.complianceEvent.deleteMany({})
  await prisma.complianceSchedule.deleteMany({})
  await prisma.clientService.deleteMany({})
  await prisma.client.deleteMany({})
  console.log("Cleared existing clients and compliance data")

  const serviceTypes = ["GST_RETURN", "TDS", "INCOME_TAX", "COMPANY_LAW", "AUDIT", "PAYROLL"]
  const clients = []

  // Create 50 clients with services
  for (let i = 1; i <= 50; i++) {
    const employee = employees[Math.floor(Math.random() * employees.length)]
    const clientName = `Client ${i} - ${["Tech", "Finance", "Retail", "Manufacturing", "Services"][Math.floor(Math.random() * 5)]} Pvt Ltd`
    
    const client = await prisma.client.create({
      data: {
        clientCode: `CLI${String(i).padStart(4, "0")}`,
        name: clientName,
        email: `client${i}@example.com`,
        phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        address: `${Math.floor(Math.random() * 1000)} Main Street, ${["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"][Math.floor(Math.random() * 5)]}`,
        pan: `ABCDE${String(i).padStart(4, "0")}F`,
        gstin: `27ABCDE${String(i).padStart(4, "0")}F1Z5`,
        assignedEmployeeId: employee.id,
        status: "ACTIVE",
        priority: ["LOW", "MEDIUM", "HIGH"][Math.floor(Math.random() * 3)] as any,
      },
    })

    clients.push(client)

    // Assign random services to each client (2-4 services per client)
    const numServices = Math.floor(Math.random() * 3) + 2
    const shuffledServices = [...serviceTypes].sort(() => Math.random() - 0.5)
    const assignedServices = shuffledServices.slice(0, numServices)

    for (const serviceType of assignedServices) {
      await prisma.clientService.create({
        data: {
          clientId: client.id,
          serviceType: serviceType as any,
          frequency: ["MONTHLY", "QUARTERLY", "ANNUAL"][Math.floor(Math.random() * 3)] as any,
          isActive: true,
          nextDueDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000),
        },
      })
    }

    if (i % 10 === 0) {
      console.log(`Created ${i} clients...`)
    }
  }

  console.log(`Successfully created ${clients.length} clients`)

  // Generate compliance events for all clients
  console.log("\nGenerating compliance events...")
  let totalEvents = 0

  for (const client of clients) {
    const services = await prisma.clientService.findMany({
      where: { clientId: client.id, isActive: true },
      select: { serviceType: true },
    })

    const serviceTypes = services.map((s) => s.serviceType)
    
    // Import the generateComplianceEventsForClient function
    const { generateComplianceEventsForClient } = await import("@/app/actions/compliance")
    const result = await generateComplianceEventsForClient(client.id, serviceTypes)
    totalEvents += result.count
  }

  console.log(`Generated ${totalEvents} compliance events`)

  // Print summary
  const [clientCount, eventCount, eventsByType, eventsByStatus] = await Promise.all([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.complianceEvent.count(),
    prisma.complianceEvent.groupBy({
      by: ["type"],
      _count: true,
    }),
    prisma.complianceEvent.groupBy({
      by: ["status"],
      _count: true,
    }),
  ])

  console.log("\nSummary:")
  console.log(`Clients: ${clientCount}`)
  console.log(`Compliance Events: ${eventCount}`)
  console.log("\nEvents by Type:")
  for (const row of eventsByType) {
    console.log(`  ${row.type}: ${row._count}`)
  }
  console.log("\nEvents by Status:")
  for (const row of eventsByStatus) {
    console.log(`  ${row.status}: ${row._count}`)
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

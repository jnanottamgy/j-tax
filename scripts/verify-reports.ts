import { config } from "dotenv"
import { addDays, subDays } from "date-fns"
import { prisma } from "../lib/prisma"

config()

async function main() {
  console.log("=".repeat(80))
  console.log("REPORTING CENTER VERIFICATION")
  console.log("=".repeat(80))
  console.log()

  const now = new Date()
  const startDate = subDays(now, 30)
  const endDate = addDays(now, 30)

  console.log("Test Parameters:")
  console.log(`  Start Date: ${startDate.toISOString()}`)
  console.log(`  End Date: ${endDate.toISOString()}`)
  console.log()

  // Test 1: Compliance Report
  console.log("─".repeat(80))
  console.log("TEST 1: Compliance Report")
  console.log("─".repeat(80))
  
  const complianceEvents = await prisma.complianceEvent.findMany({
    where: {
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: { client: { select: { id: true, name: true } } },
  })

  const upcomingDb = complianceEvents.filter(
    (e) => e.dueDate >= now && e.status !== "COMPLETED"
  )
  const overdueDb = complianceEvents.filter(
    (e) => e.status === "OVERDUE" || (e.dueDate < now && e.status !== "COMPLETED")
  )
  const completedDb = complianceEvents.filter((e) => e.status === "COMPLETED")
  const totalDb = complianceEvents.length
  const completionRateDb = totalDb > 0 ? Math.round((completedDb.length / totalDb) * 100) : 0

  console.log(`Database Counts:`)
  console.log(`  Total: ${totalDb}`)
  console.log(`  Upcoming: ${upcomingDb.length}`)
  console.log(`  Overdue: ${overdueDb.length}`)
  console.log(`  Completed: ${completedDb.length}`)
  console.log(`  Completion Rate: ${completionRateDb}%`)
  console.log()

  // Test 2: Payment Report
  console.log("─".repeat(80))
  console.log("TEST 2: Payment Report")
  console.log("─".repeat(80))
  
  const invoices = await prisma.invoice.findMany({
    where: {
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: { client: { select: { id: true, name: true } } },
  })

  const outstandingInvoicesDb = invoices.filter((i) => Number(i.outstandingAmount) > 0)
  const paidInvoicesDb = invoices.filter((i) => Number(i.paidAmount) > 0)
  const totalAmountDb = invoices.reduce((sum, i) => sum + Number(i.amount), 0)
  const totalCollectedDb = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0)
  const totalOutstandingDb = invoices.reduce((sum, i) => sum + Number(i.outstandingAmount), 0)
  const collectionRateDb = totalAmountDb > 0 ? Math.round((totalCollectedDb / totalAmountDb) * 100) : 0

  console.log(`Database Counts:`)
  console.log(`  Total Invoices: ${invoices.length}`)
  console.log(`  Outstanding: ${outstandingInvoicesDb.length}`)
  console.log(`  Paid: ${paidInvoicesDb.length}`)
  console.log(`  Total Amount: ₹${totalAmountDb.toLocaleString("en-IN")}`)
  console.log(`  Total Collected: ₹${totalCollectedDb.toLocaleString("en-IN")}`)
  console.log(`  Total Outstanding: ₹${totalOutstandingDb.toLocaleString("en-IN")}`)
  console.log(`  Collection Rate: ${collectionRateDb}%`)
  console.log()

  // Test 3: Employee Report
  console.log("─".repeat(80))
  console.log("TEST 3: Employee Report")
  console.log("─".repeat(80))
  
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  })

  const employeeIds = employees.map((e) => e.id)

  const tasks = await prisma.task.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      assignedEmployeeId: { in: employeeIds },
    },
  })

  const completedByEmployee = tasks.filter((t) => t.status === "FILED_DONE")
  const overdueByEmployee = tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "FILED_DONE")
  const totalAssignedByEmployee = tasks

  const employeeStats = employees.map((e) => {
    const completed = completedByEmployee.filter((t) => t.assignedEmployeeId === e.id).length
    const overdue = overdueByEmployee.filter((t) => t.assignedEmployeeId === e.id).length
    const assigned = totalAssignedByEmployee.filter((t) => t.assignedEmployeeId === e.id).length
    const productivity = assigned > 0 ? Math.round((completed / assigned) * 100) : 0
    return { ...e, assigned, completed, overdue, productivity }
  })

  console.log(`Database Counts:`)
  console.log(`  Total Employees: ${employees.length}`)
  console.log(`  Total Tasks: ${tasks.length}`)
  console.log(`  Completed Tasks: ${completedByEmployee.length}`)
  console.log(`  Overdue Tasks: ${overdueByEmployee.length}`)
  console.log()
  console.log(`Employee Productivity (Top 5):`)
  employeeStats.slice(0, 5).forEach((e) => {
    console.log(`  ${e.name}: ${e.productivity}% (${e.completed}/${e.assigned} completed, ${e.overdue} overdue)`)
  })
  console.log()

  // Test 4: Client Report
  console.log("─".repeat(80))
  console.log("TEST 4: Client Report")
  console.log("─".repeat(80))
  
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      clientCode: true,
      assignedEmployeeName: true,
      assignedEmployeeId: true,
    },
    orderBy: { name: "asc" },
    take: 200,
  })

  const clientIds = clients.map((c) => c.id)

  const clientComplianceEvents = await prisma.complianceEvent.findMany({
    where: {
      clientId: { in: clientIds },
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  const clientInvoices = await prisma.invoice.findMany({
    where: { clientId: { in: clientIds } },
  })

  const clientTasks = await prisma.task.findMany({
    where: {
      clientId: { in: clientIds },
      status: { not: "FILED_DONE" },
    },
  })

  const clientStats = clients.map((c) => {
    const complianceEvents = clientComplianceEvents.filter((e) => e.clientId === c.id)
    const total = complianceEvents.length
    const overdue = complianceEvents.filter(
      (e) => e.status === "OVERDUE" || (e.dueDate < now && e.status !== "COMPLETED")
    ).length
    const completed = complianceEvents.filter((e) => e.status === "COMPLETED").length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const complianceScore = Math.max(
      0,
      Math.min(100, completionRate - Math.round((overdue / Math.max(total, 1)) * 50))
    )

    const outstandingPayments = clientInvoices
      .filter((i) => i.clientId === c.id)
      .reduce((sum, i) => sum + Number(i.outstandingAmount), 0)
    const openTasks = clientTasks.filter((t) => t.clientId === c.id).length

    return {
      ...c,
      complianceScore,
      outstandingPayments,
      openTasks,
    }
  })

  console.log(`Database Counts:`)
  console.log(`  Total Clients: ${clients.length}`)
  console.log(`  Total Compliance Events: ${clientComplianceEvents.length}`)
  console.log(`  Total Invoices: ${clientInvoices.length}`)
  console.log(`  Total Open Tasks: ${clientTasks.length}`)
  console.log()
  console.log(`Client Compliance Scores (Top 5):`)
  clientStats.slice(0, 5).forEach((c) => {
    console.log(`  ${c.name}: ${c.complianceScore} (outstanding: ₹${c.outstandingPayments.toLocaleString("en-IN")}, tasks: ${c.openTasks})`)
  })
  console.log()

  // Test 5: Filter Options
  console.log("─".repeat(80))
  console.log("TEST 5: Filter Options")
  console.log("─".repeat(80))
  
  const activeEmployees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, department: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  })

  const allClients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  })

  const departments = Array.from(
    new Set(activeEmployees.map((e) => e.department).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b))

  console.log(`Database Counts:`)
  console.log(`  Active Employees: ${activeEmployees.length}`)
  console.log(`  Clients: ${allClients.length}`)
  console.log(`  Departments: ${departments.length}`)
  console.log()
  console.log(`Departments: ${departments.join(", ")}`)
  console.log()

  console.log("=".repeat(80))
  console.log("VERIFICATION COMPLETE")
  console.log("=".repeat(80))
}

main()
  .then(() => {
    console.log("\n✅ Verification script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Verification script failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import 'dotenv/config'
import { prisma } from '../lib/prisma'

// Fake data generators
const firstNames = ['Rajesh', 'Priya', 'Amit', 'Neha', 'Vikram', 'Anita', 'Rahul', 'Sneha', 'Deepak', 'Pooja', 'Suresh', 'Kavita', 'Arun', 'Meera', 'Vijay', 'Lakshmi', 'Sanjay', 'Rekha', 'Mukesh', 'Sunita']
const lastNames = ['Sharma', 'Patel', 'Singh', 'Gupta', 'Kumar', 'Verma', 'Reddy', 'Nair', 'Iyer', 'Menon', 'Shah', 'Mehta', 'Jain', 'Agarwal', 'Bansal', 'Chopra', 'Das', 'Sen', 'Roy', 'Chatterjee']
const departments = ['Tax', 'Audit', 'Consulting', 'Compliance', 'Advisory']
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Kolkata']
const services = ['GST Filing', 'Income Tax', 'TDS Returns', 'Audit', 'Consulting', 'Compliance', 'Payroll', 'Bookkeeping']
const clientPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const serviceTypes = ['GST_RETURN', 'INCOME_TAX', 'TDS', 'PAYROLL', 'BOOKKEEPING', 'AUDIT', 'COMPANY_LAW', 'OTHER']
const taskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const taskStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'DATA_AWAITED', 'UNDER_REVIEW', 'FILED_DONE', 'ON_HOLD']
const invoiceStatuses = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED', 'WAIVED']

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function generateEmail(firstName: string, lastName: string, index: number): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@taxwise.com`
}

function generatePhone(): string {
  return `+91 ${getRandomNumber(70000, 99999)} ${getRandomNumber(10000, 99999)}`
}

function generateGSTIN(): string {
  const states = ['MH', 'DL', 'KA', 'TN', 'TS', 'MH', 'GJ', 'WB']
  const stateCode = getRandomItem(states)
  const pan = generatePAN()
  return `${stateCode}${pan}Z${getRandomNumber(1, 9)}`
}

function generatePAN(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let pan = ''
  for (let i = 0; i < 5; i++) {
    pan += letters[Math.floor(Math.random() * letters.length)]
  }
  pan += getRandomNumber(1000, 9999)
  pan += letters[Math.floor(Math.random() * letters.length)]
  return pan
}

function generateClientName(): string {
  const prefixes = ['M/s', 'Shree', 'Sri', 'The', '']
  const suffixes = ['Pvt Ltd', 'Ltd', 'LLP', 'Partnership', 'Enterprises', 'Consultants', 'Associates', 'Services']
  const businessTypes = ['Tech', 'Global', 'India', 'Solutions', 'Systems', 'Industries', 'Corporation', 'Group', 'Holdings', 'Ventures']
  
  const prefix = getRandomItem(prefixes)
  const business = getRandomItem(businessTypes)
  const suffix = getRandomItem(suffixes)
  
  return prefix ? `${prefix} ${business} ${suffix}` : `${business} ${suffix}`
}

async function main() {
  console.log('🌱 Starting operational seed...')

  // Clean existing data
  console.log('🧹 Cleaning existing data...')
  await prisma.notification.deleteMany()
  await prisma.taskComment.deleteMany()
  await prisma.taskAttachment.deleteMany()
  await prisma.task.deleteMany()
  await prisma.paymentReceipt.deleteMany()
  await prisma.followUp.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.client.deleteMany()
  await prisma.employee.deleteMany()

  console.log('✅ Data cleaned')

  // Create 10 fake employees
  console.log('👥 Creating 10 fake employees...')
  const employees = []
  for (let i = 0; i < 10; i++) {
    const firstName = getRandomItem(firstNames)
    const lastName = getRandomItem(lastNames)
    const employee = await prisma.employee.create({
      data: {
        name: `${firstName} ${lastName}`,
        email: generateEmail(firstName, lastName, i),
        department: getRandomItem(departments),
        isActive: true,
      },
    })
    employees.push(employee)
    console.log(`  ✓ Created employee: ${employee.name}`)
  }

  // Create 100 fake clients
  console.log('🏢 Creating 100 fake clients...')
  const clients = []
  for (let i = 0; i < 100; i++) {
    const clientName = generateClientName()
    const assignedEmployee = getRandomItem(employees)
    const client = await prisma.client.create({
      data: {
        clientCode: `CLI-${String(i + 1).padStart(4, '0')}`,
        name: clientName,
        gstin: generateGSTIN(),
        pan: generatePAN(),
        email: `contact@${clientName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: generatePhone(),
        whatsapp: generatePhone(),
        address: `${getRandomNumber(1, 999)}, ${getRandomItem(cities)}`,
        priority: getRandomItem(clientPriorities) as any,
        status: 'ACTIVE',
        assignedEmployeeId: assignedEmployee.id,
      },
    })
    clients.push(client)
    console.log(`  ✓ Created client: ${client.name}`)
  }

  // Create 500 fake tasks
  console.log('📋 Creating 500 fake tasks...')
  const tasks = []
  for (let i = 0; i < 500; i++) {
    const client = getRandomItem(clients)
    const employee = getRandomItem(employees)
    const service = getRandomItem(serviceTypes)
    const status = getRandomItem(taskStatuses)
    const priority = getRandomItem(taskPriorities)
    
    const dueDate = getRandomDate(new Date('2026-06-01'), new Date('2026-07-31'))
    const completionDate = status === 'FILED_DONE' ? getRandomDate(dueDate, new Date('2026-08-01')) : null
    
    const task = await prisma.task.create({
      data: {
        title: `${service} - ${client.name}`,
        description: `Complete ${service.toLowerCase()} for ${client.name} for the current fiscal year.`,
        status: status as any,
        priority: priority as any,
        dueDate,
        completionDate,
        serviceType: service as any,
        assignedEmployeeId: employee.id,
        clientId: client.id,
      },
    })
    tasks.push(task)
    console.log(`  ✓ Created task: ${task.title}`)
  }

  // Create 200 fake invoices
  console.log('💰 Creating 200 fake invoices...')
  const invoices = []
  for (let i = 0; i < 200; i++) {
    const client = getRandomItem(clients)
    const amount = getRandomNumber(5000, 50000)
    const status = getRandomItem(invoiceStatuses)
    const paidAmount = status === 'PAID' ? amount : status === 'PARTIALLY_PAID' ? amount * 0.5 : 0
    const outstandingAmount = amount - paidAmount
    
    const issueDate = getRandomDate(new Date('2026-06-01'), new Date('2026-06-30'))
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${2026}-${String(i + 1).padStart(4, '0')}`,
        clientId: client.id,
        amount,
        paidAmount,
        outstandingAmount,
        status: status as any,
        issueDate,
        dueDate,
      },
    })
    invoices.push(invoice)
    console.log(`  ✓ Created invoice: ${invoice.invoiceNumber}`)
  }

  // Create 1000 fake notifications
  console.log('🔔 Creating 1000 fake notifications...')
  const notificationTypes = ['TASK_ASSIGNED', 'TASK_OVERDUE', 'COMPLIANCE_DUE', 'PAYMENT_RECEIVED', 'INVOICE_OVERDUE', 'DOCUMENT_UPLOADED', 'INFO', 'WARNING', 'ALERT']
  const users = await prisma.user.findMany()
  
  for (let i = 0; i < 1000; i++) {
    const user = getRandomItem(users)
    const type = getRandomItem(notificationTypes)
    const task = getRandomItem(tasks)
    const client = getRandomItem(clients)
    
    let title = ''
    let message = ''
    
    switch (type) {
      case 'TASK_ASSIGNED':
        title = 'New Task Assigned'
        message = `You have been assigned to: ${task.title}`
        break
      case 'TASK_OVERDUE':
        title = 'Task Overdue'
        message = `${task.title} is overdue`
        break
      case 'COMPLIANCE_DUE':
        title = 'Compliance Due'
        message = `Compliance deadline approaching for ${client.name}`
        break
      case 'PAYMENT_RECEIVED':
        title = 'Payment Received'
        message = `Payment received from ${client.name}`
        break
      case 'INVOICE_OVERDUE':
        title = 'Invoice Overdue'
        message = `Invoice overdue for ${client.name}`
        break
      case 'DOCUMENT_UPLOADED':
        title = 'Document Uploaded'
        message = `New document uploaded for ${client.name}`
        break
      case 'INFO':
        title = 'System Update'
        message = 'A new feature has been added to the system'
        break
      case 'WARNING':
        title = 'Attention Required'
        message = 'Please review the pending items in your dashboard'
        break
      case 'ALERT':
        title = 'Urgent Action Required'
        message = 'Immediate attention needed for critical compliance deadline'
        break
    }
    
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: type as any,
        title,
        message,
        read: Math.random() > 0.5,
        createdAt: getRandomDate(new Date('2026-06-01'), new Date()),
      },
    })
    console.log(`  ✓ Created notification: ${title}`)
  }

  console.log('✅ Operational seed completed successfully!')
  console.log(`📊 Summary:`)
  console.log(`  - Employees: ${employees.length}`)
  console.log(`  - Clients: ${clients.length}`)
  console.log(`  - Tasks: ${tasks.length}`)
  console.log(`  - Invoices: ${invoices.length}`)
  console.log(`  - Notifications: 1000`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

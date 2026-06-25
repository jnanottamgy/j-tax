// Query optimization utilities for performance improvements

export interface QueryOptimizationOptions {
  select?: string[]
  include?: string[]
  where?: Record<string, any>
  orderBy?: Record<string, "asc" | "desc">
  take?: number
  skip?: number
  cache?: boolean
  cacheTTL?: number
}

export function optimizeQuery<T>(
  baseQuery: any,
  options: QueryOptimizationOptions
): any {
  let query = baseQuery

  // Select specific fields to reduce data transfer
  if (options.select && options.select.length > 0) {
    query = query.select(options.select.join(", "))
  }

  // Include related data efficiently
  if (options.include && options.include.length > 0) {
    options.include.forEach((relation) => {
      query = query.include(relation)
    })
  }

  // Apply where clauses
  if (options.where) {
    query = query.where(options.where)
  }

  // Apply sorting
  if (options.orderBy) {
    Object.entries(options.orderBy).forEach(([field, direction]) => {
      query = query.orderBy({ [field]: direction })
    })
  }

  // Apply pagination
  if (options.take) {
    query = query.take(options.take)
  }

  if (options.skip) {
    query = query.skip(options.skip)
  }

  return query
}

export function createPaginatedQuery<T>(
  baseQuery: any,
  page: number,
  pageSize: number
): { query: any; skip: number; take: number } {
  const skip = (page - 1) * pageSize
  const take = pageSize

  return {
    query: baseQuery.skip(skip).take(take),
    skip,
    take,
  }
}

export function optimizeClientQuery(options: {
  search?: string
  status?: string
  priority?: string
  assignedEmployeeId?: string
  page?: number
  pageSize?: number
}) {
  const where: Record<string, any> = {}

  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { clientCode: { contains: options.search, mode: "insensitive" } },
      { gstin: { contains: options.search, mode: "insensitive" } },
      { email: { contains: options.search, mode: "insensitive" } },
    ]
  }

  if (options.status) {
    where.status = options.status
  }

  if (options.priority) {
    where.priority = options.priority
  }

  if (options.assignedEmployeeId) {
    where.assignedEmployeeId = options.assignedEmployeeId
  }

  return {
    where,
    orderBy: { dueDate: "asc" as const },
    include: {
      services: true,
      assignedEmployee: true,
    },
  }
}

export function optimizeTaskQuery(options: {
  search?: string
  status?: string
  priority?: string
  assignedEmployeeId?: string
  clientId?: string
  page?: number
  pageSize?: number
}) {
  const where: Record<string, any> = {}

  if (options.search) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" } },
      { description: { contains: options.search, mode: "insensitive" } },
    ]
  }

  if (options.status) {
    where.status = options.status
  }

  if (options.priority) {
    where.priority = options.priority
  }

  if (options.assignedEmployeeId) {
    where.assignedEmployeeId = options.assignedEmployeeId
  }

  if (options.clientId) {
    where.clientId = options.clientId
  }

  return {
    where,
    orderBy: { dueDate: "asc" as const },
    include: {
      client: true,
      assignedEmployee: true,
    },
  }
}

export function optimizeDashboardQuery() {
  return {
    clients: {
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        nextDueDate: true,
      },
      take: 5,
      orderBy: { nextDueDate: "asc" as const },
    },
    tasks: {
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
      take: 5,
      where: { status: { not: "FILED_DONE" } },
      orderBy: { dueDate: "asc" as const },
    },
    invoices: {
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        status: true,
        dueDate: true,
      },
      take: 5,
      where: { status: { not: "PAID" } },
      orderBy: { dueDate: "asc" as const },
    },
    complianceEvents: {
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
      },
      take: 5,
      where: { status: { not: "COMPLETED" } },
      orderBy: { dueDate: "asc" as const },
    },
  }
}

export function getQueryCacheKey(entity: string, options: Record<string, any>): string {
  return `${entity}:${JSON.stringify(options)}`
}

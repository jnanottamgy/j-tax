// Database connection pooling configuration
// This file configures Prisma connection pooling for better scalability

export const databasePoolConfig = {
  // Connection pool size
  // Adjust based on your database server capacity
  connectionLimit: 10,
  
  // Connection timeout in seconds
  connectionTimeout: 10,
  
  // Idle timeout in seconds
  // Connections idle for longer than this will be closed
  idleTimeout: 600,
  
  // Maximum lifetime of a connection in seconds
  // Connections older than this will be closed and replaced
  maxLifetime: 1800,
  
  // Enable statement caching
  statementCacheSize: 100,
  
  // Enable prepared statements
  preparedStatements: true,
}

// Prisma datasource configuration for production
export const prismaDatasourceConfig = {
  url: process.env.DATABASE_URL,
  
  // Connection pooling for PostgreSQL
  // Format: postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=10
}

export function getDatabaseUrlWithPooling(): string {
  const baseUrl = process.env.DATABASE_URL || ""
  
  if (!baseUrl) {
    return baseUrl
  }
  
  // Add connection pool parameters if not already present
  const poolParams = new URLSearchParams({
    connection_limit: databasePoolConfig.connectionLimit.toString(),
    pool_timeout: databasePoolConfig.connectionTimeout.toString(),
    statement_cache_size: databasePoolConfig.statementCacheSize.toString(),
  })
  
  const url = new URL(baseUrl)
  const existingParams = new URLSearchParams(url.search)
  
  // Merge parameters
  poolParams.forEach((value, key) => {
    if (!existingParams.has(key)) {
      existingParams.set(key, value)
    }
  })
  
  url.search = existingParams.toString()
  return url.toString()
}

// Read replica configuration for read-heavy workloads
export const readReplicaConfig = {
  enabled: process.env.ENABLE_READ_REPLICAS === "true",
  replicas: process.env.READ_REPLICA_URLS?.split(",") || [],
  loadBalancing: "round-robin" as "round-robin" | "random",
}

export function getReadReplicaUrl(): string {
  if (!readReplicaConfig.enabled || readReplicaConfig.replicas.length === 0) {
    return process.env.DATABASE_URL || ""
  }
  
  // Simple round-robin selection
  const index = Math.floor(Math.random() * readReplicaConfig.replicas.length)
  return readReplicaConfig.replicas[index]
}

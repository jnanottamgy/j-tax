import pg from 'pg'

// Reproduce what's likely in Vercel: the value WITH surrounding quotes
const QUOTED = '"postgresql://postgres.xksanwabjeatskyqwdbg:WQsQ%40vQe6tq%40k6z@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"'

const start = Date.now()
const pool = new pg.Pool({ connectionString: QUOTED, connectionTimeoutMillis: 9000 })
try {
  await pool.query('select 1')
  console.log('QUOTED string: connected (unexpected) in', Date.now() - start, 'ms')
} catch (e) {
  console.log('QUOTED string after', Date.now() - start, 'ms ->', e.code || '', e.message)
} finally {
  try { await pool.end() } catch {}
}

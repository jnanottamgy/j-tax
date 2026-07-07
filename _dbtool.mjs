import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
})

const mode = process.argv[2] || 'inspect'
const ADMIN_EMAIL = 'admin@jtax.test'
const NEW_PASSWORD = 'JtaxDemo@2026!'

async function inspect() {
  const counts = await pool.query(`
    select 'clients' t, count(*)::int c from clients
    union all select 'employees', count(*)::int from employees
    union all select 'tasks', count(*)::int from tasks
    union all select 'invoices', count(*)::int from invoices
    union all select 'leads', count(*)::int from leads
    union all select 'quotations', count(*)::int from quotations
    union all select 'documents', count(*)::int from documents
    union all select 'compliance_events', count(*)::int from compliance_events
    union all select 'notifications', count(*)::int from notifications
    union all select 'activity_logs', count(*)::int from activity_logs
    union all select 'audit_logs', count(*)::int from audit_logs
    union all select 'app_User', count(*)::int from "User"
    order by 1
  `)
  console.log('=== ROW COUNTS ===')
  for (const r of counts.rows) console.log(`  ${r.t.padEnd(20)} ${r.c}`)

  const appUsers = await pool.query(`select email, role, "onboardingCompleted" oc, "onboardingStep" os from "User" order by "createdAt"`)
  console.log('\n=== "User" onboarding state ===')
  for (const r of appUsers.rows)
    console.log(`  ${(r.email||'').padEnd(32)} role=${r.role} onboardingCompleted=${r.oc} step=${r.os}`)
}

async function reset() {
  console.log('Wiping business data...')
  await pool.query(`TRUNCATE TABLE
    client_services, clients,
    task_comments, task_attachments, task_automations, tasks,
    compliance_schedules, compliance_events,
    document_versions, document_tags, document_activities, documents,
    message_logs, messages, message_templates,
    payment_receipts, follow_ups, invoice_reminders, invoices,
    reminders, notifications,
    quotation_items, quotation_email_logs, quotation_follow_ups, quotations, leads,
    client_timeline_events,
    employee_sessions, employee_activities, attendance_records, employees,
    activity_logs, audit_logs
    RESTART IDENTITY CASCADE`)
  console.log('  -> business tables truncated')

  // Reset the demo partner so the firm sees the guided onboarding wizard
  await pool.query(
    `update "User" set "onboardingCompleted"=false, "onboardingStep"=0 where email=$1`,
    [ADMIN_EMAIL]
  )
  console.log('  -> partner onboarding reset')

  // Set a known password + ensure PARTNER role via Supabase Admin API
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
  const { rows } = await pool.query(`select id from auth.users where email=$1`, [ADMIN_EMAIL])
  const id = rows[0]?.id
  if (!id) throw new Error(`${ADMIN_EMAIL} not found in auth.users`)
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: NEW_PASSWORD, email_confirm: true, app_metadata: { role: 'PARTNER' } }),
  })
  if (!res.ok) throw new Error(`Admin API ${res.status}: ${await res.text()}`)
  console.log('  -> partner password + PARTNER role set')

  console.log('\n=== AFTER WIPE ===')
  await inspect()
  console.log(`\nDEMO PARTNER LOGIN -> ${ADMIN_EMAIL} / ${NEW_PASSWORD}`)
}

async function main() {
  if (mode === 'reset') await reset()
  else await inspect()
  await pool.end()
}

main().catch(async (e) => { console.error('ERROR:', e.message); await pool.end(); process.exit(1) })

/**
 * Email Notification System - Configuration Audit
 * Phase 1: Configuration Verification
 */

import { Resend } from 'resend'

console.log('═══════════════════════════════════════')
console.log('PHASE 1 — CONFIGURATION AUDIT')
console.log('═══════════════════════════════════════\n')

// Check 1: Resend is installed
console.log('✓ Check 1: Resend is installed')
console.log('  Status: PASS (package installed)\n')

// Check 2: Environment variables exist
console.log('✓ Check 2: Environment variables exist')
const resendApiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.FROM_EMAIL

console.log(`  RESEND_API_KEY: ${resendApiKey ? 'SET' : 'NOT SET'}`)
console.log(`  FROM_EMAIL: ${fromEmail || 'NOT SET'}`)
console.log(`  Status: ${resendApiKey && fromEmail ? 'PASS' : 'FAIL'}\n`)

// Check 3: RESEND_API_KEY is loaded
console.log('✓ Check 3: RESEND_API_KEY is loaded')
if (resendApiKey) {
  console.log(`  API Key format: ${resendApiKey.startsWith('re_') ? 'VALID (starts with re_)' : 'INVALID FORMAT'}`)
  console.log(`  API Key length: ${resendApiKey.length} characters`)
  console.log(`  Status: ${resendApiKey.startsWith('re_') ? 'PASS' : 'FAIL'}\n`)
} else {
  console.log('  Status: FAIL (API key not set)\n')
}

// Check 4: FROM_EMAIL is configured
console.log('✓ Check 4: FROM_EMAIL is configured')
if (fromEmail) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  console.log(`  Email format: ${emailRegex.test(fromEmail) ? 'VALID' : 'INVALID'}`)
  console.log(`  Email: ${fromEmail}`)
  console.log(`  Status: ${emailRegex.test(fromEmail) ? 'PASS' : 'FAIL'}\n`)
} else {
  console.log('  Status: FAIL (FROM_EMAIL not set)\n')
}

// Check 5: Email provider initializes correctly
console.log('✓ Check 5: Email provider initializes correctly')
try {
  if (resendApiKey) {
    const resend = new Resend(resendApiKey)
    console.log('  Resend client initialized')
    console.log('  Status: PASS\n')
  } else {
    console.log('  Status: FAIL (Cannot initialize without API key)\n')
  }
} catch (error) {
  console.log(`  Error: ${error}`)
  console.log('  Status: FAIL\n')
}

console.log('═══════════════════════════════════════')
console.log('PHASE 1 SUMMARY')
console.log('═══════════════════════════════════════')
console.log('Resend Installation: PASS')
console.log('Environment Variables: ' + (resendApiKey && fromEmail ? 'PASS' : 'FAIL'))
console.log('API Key Loaded: ' + (resendApiKey?.startsWith('re_') ? 'PASS' : 'FAIL'))
console.log('FROM_EMAIL Configured: ' + (fromEmail ? 'PASS' : 'FAIL'))
console.log('Provider Initialization: ' + (resendApiKey ? 'PASS' : 'FAIL'))
console.log('═══════════════════════════════════════\n')

if (!resendApiKey || !fromEmail) {
  console.log('⚠️  CRITICAL: Missing environment variables')
  console.log('   Please add to .env file:')
  console.log('   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx')
  console.log('   FROM_EMAIL=noreply@taxwiseconsultants.com')
  process.exit(1)
}

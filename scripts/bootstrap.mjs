// Bootstrap local Turso database for development.
// Idempotent: safe to run multiple times.
// Usage: node scripts/bootstrap.mjs
import { execSync } from 'node:child_process'

const DB_NAME = process.env.TURSO_DB_NAME || 'do-epub-studio-local'

function run(cmd, description) {
  console.log(`→ ${description}...`)
  try {
    execSync(cmd, { stdio: 'inherit' })
  } catch (err) {
    // Many Turso commands fail gracefully if the resource already exists
    const stderr = err.stderr?.toString?.() || ''
    if (stderr.includes('already exists') || stderr.includes('already')) {
      console.log(`  (already exists, skipping)`)
      return
    }
    console.error(`✗ Failed: ${description}`)
    console.error(stderr || err.message)
    process.exit(1)
  }
}

run(
  `turso db create ${DB_NAME}`,
  `Create local Turso DB '${DB_NAME}'`
)
console.log('✓ Local Turso DB ready.')

run(
  `turso db tokens create ${DB_NAME}`,
  'Generate local auth token'
)
console.log('✓ Auth token generated.')

console.log('\nNext: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local')

// Apply local Turso migrations.
// Idempotent: safe to run multiple times.
// Usage: node scripts/db-migrate-local.mjs
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DB_NAME = process.env.TURSO_DB_NAME || 'do-epub-studio-local'
const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = process.env.TURSO_MIGRATIONS_DIR || resolve(__dirname, '../packages/schema/migrations')

// Find migration files — supports both .sql and directories
import { readdirSync, existsSync } from 'node:fs'

if (!existsSync(MIGRATIONS_DIR)) {
  console.error(`✗ Migrations directory not found: ${MIGRATIONS_DIR}`)
  console.error('  Set TURSO_MIGRATIONS_DIR to the correct path.')
  process.exit(1)
}

const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()

if (files.length === 0) {
  console.error(`✗ No .sql migration files found in ${MIGRATIONS_DIR}`)
  process.exit(1)
}

console.log(`Found ${files.length} migration file(s):`)
for (const f of files) {
  console.log(`  - ${f}`)
}
console.log()

for (const file of files) {
  const filePath = resolve(MIGRATIONS_DIR, file)
  const cmd = `turso db execute --db ${DB_NAME} --file "${filePath}"`
  console.log(`→ Applying ${file}...`)
  try {
    execSync(cmd, { stdio: 'pipe' })
    console.log(`  ✓ ${file}`)
  } catch (err) {
    const stderr = err.stderr?.toString?.() || ''
    if (stderr.includes('already exists') || stderr.includes('duplicate')) {
      console.log(`  (already applied, skipping)`)
    } else {
      console.error(`✗ Failed to apply ${file}`)
      console.error(stderr || err.message)
      process.exit(1)
    }
  }
}

console.log('\n✓ All migrations applied.')

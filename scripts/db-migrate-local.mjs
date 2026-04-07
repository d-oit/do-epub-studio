// Example local migration script
import { execSync } from 'child_process'

const cmd = 'turso db execute --db do-epub-studio-local --file migrations/20260407_create_tables.sql'
execSync(cmd, { stdio: 'inherit' })
console.log('Local migration applied.')

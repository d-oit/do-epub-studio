// Example bootstrap script
import { execSync } from 'child_process'

// Create local Turso DB
execSync('turso db create do-epub-studio-local', { stdio: 'inherit' })
console.log('Local Turso DB created.')

// Generate local auth token
execSync('turso db tokens create do-epub-studio-local', { stdio: 'inherit' })
console.log('Local auth token generated.')

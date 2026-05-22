/**
 * One-off script to create an admin employee.
 *
 * Usage (from the backend/ directory):
 *   $env:DATABASE_URL="postgres://user:pass@localhost:5432/ideafarming"
 *   npx ts-node --transpile-only --skip-project scripts/create-admin.ts <email> <password>
 *
 * Or if the app is running via docker-compose and DATABASE_URL is already set:
 *   npx ts-node --transpile-only --skip-project scripts/create-admin.ts admin@example.com MySecret123
 */

import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

async function main() {
  const [email, password] = process.argv.slice(2)

  if (!email || !password) {
    console.error('Usage: create-admin.ts <email> <password>')
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const { rows } = await pool.query(
      `INSERT INTO employees (email, password_hash, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = TRUE
       RETURNING id, email, role, created_at`,
      [email.toLowerCase().trim(), password_hash],
    )
    const admin = rows[0]
    console.log(`Admin user ready:  id=${admin.id}  email=${admin.email}  role=${admin.role}  created_at=${admin.created_at}`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

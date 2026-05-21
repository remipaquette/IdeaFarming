import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const migrationsDir = path.join(__dirname, '..', 'migrations')
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT 1 FROM _migrations WHERE name = $1',
      [file],
    )
    if (rows.length === 0) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      if (sql.trim()) {
        await pool.query(sql)
      }
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
    }
  }
}

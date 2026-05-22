import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool } from '../db'

const BCRYPT_ROUNDS = 12
const RESET_TOKEN_TTL_HOURS = 1

export interface Employee {
  id: number
  email: string
  role: 'admin' | 'employee'
  is_active: boolean
  created_at: Date
}

export interface AuthPayload {
  sub: number
  email: string
  role: 'admin' | 'employee'
}

// Admin provisions a new Employee account
export async function provisionEmployee(
  email: string,
  plainPassword: string,
  role: 'admin' | 'employee' = 'employee',
): Promise<Employee> {
  const password_hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS)
  const { rows } = await pool.query<Employee>(
    `INSERT INTO employees (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, is_active, created_at`,
    [email.toLowerCase().trim(), password_hash, role],
  )
  return rows[0]
}

// Admin deactivates an Employee account
export async function deactivateEmployee(employeeId: number): Promise<void> {
  const { rowCount } = await pool.query(
    'UPDATE employees SET is_active = FALSE WHERE id = $1',
    [employeeId],
  )
  if (rowCount === 0) {
    throw new Error('Employee not found')
  }
}

// Verify email/password and return the Employee if valid
export async function verifyCredentials(
  email: string,
  plainPassword: string,
): Promise<Employee> {
  const { rows } = await pool.query<Employee & { password_hash: string }>(
    'SELECT id, email, role, is_active, created_at, password_hash FROM employees WHERE email = $1',
    [email.toLowerCase().trim()],
  )
  const employee = rows[0]
  if (!employee) {
    // Constant-time rejection to prevent email enumeration
    await bcrypt.compare(plainPassword, '$2a$12$invalidhashpadding000000000000000000000000000000000000')
    throw new Error('Invalid credentials')
  }
  const valid = await bcrypt.compare(plainPassword, employee.password_hash)
  if (!valid) {
    throw new Error('Invalid credentials')
  }
  if (!employee.is_active) {
    throw new Error('Account deactivated')
  }
  const { password_hash: _omit, ...rest } = employee
  return rest as Employee
}

// Generate a password reset token, store its hash, return the raw token
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: number }>(
    'SELECT id FROM employees WHERE email = $1 AND is_active = TRUE',
    [email.toLowerCase().trim()],
  )
  if (rows.length === 0) {
    // Don't reveal whether the email exists
    return null
  }
  const employeeId = rows[0].id
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000)

  // Invalidate any prior unused tokens for this employee
  await pool.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE employee_id = $1 AND used_at IS NULL',
    [employeeId],
  )

  await pool.query(
    `INSERT INTO password_reset_tokens (employee_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [employeeId, tokenHash, expiresAt],
  )

  return rawToken
}

// Reset password using a valid token
export async function resetPasswordWithToken(
  rawToken: string,
  newPlainPassword: string,
): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const { rows } = await pool.query<{
    id: number
    employee_id: number
    expires_at: Date
    used_at: Date | null
  }>(
    `SELECT id, employee_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  )
  const tokenRow = rows[0]
  if (!tokenRow) {
    throw new Error('Invalid or expired reset token')
  }
  if (tokenRow.used_at !== null) {
    throw new Error('Reset token has already been used')
  }
  if (new Date() > new Date(tokenRow.expires_at)) {
    throw new Error('Reset token has expired')
  }

  const password_hash = await bcrypt.hash(newPlainPassword, BCRYPT_ROUNDS)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'UPDATE employees SET password_hash = $1 WHERE id = $2',
      [password_hash, tokenRow.employee_id],
    )
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenRow.id],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Get all employees (Admin use)
export async function listEmployees(): Promise<Employee[]> {
  const { rows } = await pool.query<Employee>(
    'SELECT id, email, role, is_active, created_at FROM employees ORDER BY created_at DESC',
  )
  return rows
}

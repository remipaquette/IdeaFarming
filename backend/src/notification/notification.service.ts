import { pool } from '../db'

export interface Notification {
  id: number
  employee_id: number
  type: string
  payload: Record<string, unknown>
  read: boolean
  created_at: Date
}

export async function listNotifications(employeeId: number): Promise<Notification[]> {
  const { rows } = await pool.query<Notification>(
    `SELECT id, employee_id, type, payload, read, created_at
     FROM notifications
     WHERE employee_id = $1
     ORDER BY created_at DESC`,
    [employeeId],
  )
  return rows
}

export async function getUnreadCount(employeeId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM notifications WHERE employee_id = $1 AND read = FALSE`,
    [employeeId],
  )
  return parseInt(rows[0].count, 10)
}

export async function markNotificationRead(
  notificationId: number,
  employeeId: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE notifications SET read = TRUE WHERE id = $1 AND employee_id = $2`,
    [notificationId, employeeId],
  )
  return (rowCount ?? 0) > 0
}

export async function markAllNotificationsRead(employeeId: number): Promise<void> {
  await pool.query(`UPDATE notifications SET read = TRUE WHERE employee_id = $1`, [employeeId])
}

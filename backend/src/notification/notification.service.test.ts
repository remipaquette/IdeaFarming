import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './notification.service'

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pool } = require('../db') as { pool: { query: jest.Mock } }

beforeEach(() => {
  pool.query.mockReset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeNotificationRow = (overrides: Partial<{
  id: number
  employee_id: number
  type: string
  payload: object
  read: boolean
}> = {}) => ({
  id: overrides.id ?? 1,
  employee_id: overrides.employee_id ?? 10,
  type: overrides.type ?? 'comment_on_idea',
  payload: overrides.payload ?? { idea_id: 5, comment_id: 20 },
  read: overrides.read ?? false,
  created_at: new Date(),
})

// ---------------------------------------------------------------------------
// listNotifications — returns notifications newest first
// ---------------------------------------------------------------------------

describe('listNotifications', () => {
  it('returns all notifications for the given employee ordered newest first', async () => {
    const rows = [
      makeNotificationRow({ id: 3 }),
      makeNotificationRow({ id: 2 }),
      makeNotificationRow({ id: 1 }),
    ]
    pool.query.mockResolvedValueOnce({ rows })

    const result = await listNotifications(10)

    expect(result).toHaveLength(3)
    expect(result[0].id).toBe(3)
    const calls = pool.query.mock.calls as [string, unknown[]][]
    expect(calls[0][1]).toEqual([10])
    expect(calls[0][0]).toContain('ORDER BY created_at DESC')
  })

  it('returns an empty array when the employee has no notifications', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const result = await listNotifications(99)
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getUnreadCount — counts only unread notifications
// ---------------------------------------------------------------------------

describe('getUnreadCount', () => {
  it('returns the unread count for the employee', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '7' }] })

    const count = await getUnreadCount(10)

    expect(count).toBe(7)
    const calls = pool.query.mock.calls as [string, unknown[]][]
    expect(calls[0][0]).toContain('read = FALSE')
    expect(calls[0][1]).toEqual([10])
  })

  it('returns 0 when there are no unread notifications', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    const count = await getUnreadCount(10)
    expect(count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// markNotificationRead — only marks the recipient's notification
// ---------------------------------------------------------------------------

describe('markNotificationRead', () => {
  it('returns true when the notification belongs to the employee and is marked read', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 })

    const result = await markNotificationRead(42, 10)

    expect(result).toBe(true)
    const calls = pool.query.mock.calls as [string, unknown[]][]
    // Must scope update to both notification id AND employee_id to prevent cross-user access
    expect(calls[0][1]).toEqual([42, 10])
    expect(calls[0][0]).toContain('employee_id')
  })

  it('returns false when the notification does not belong to the employee', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 })

    const result = await markNotificationRead(42, 99) // wrong employee

    expect(result).toBe(false)
  })

  it('does NOT update another employees notification (wrong employee_id)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 })

    await markNotificationRead(42, 99)

    const calls = pool.query.mock.calls as [string, unknown[]][]
    // The query parameters must include both notification id and employee id
    expect((calls[0][1] as unknown[]).includes(42)).toBe(true)
    expect((calls[0][1] as unknown[]).includes(99)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// markAllNotificationsRead — bulk update scoped to employee
// ---------------------------------------------------------------------------

describe('markAllNotificationsRead', () => {
  it('issues an UPDATE scoped to the employee_id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 5 })

    await markAllNotificationsRead(10)

    const calls = pool.query.mock.calls as [string, unknown[]][]
    expect(calls[0][0]).toContain('UPDATE notifications')
    expect(calls[0][0]).toContain('employee_id')
    expect(calls[0][1]).toEqual([10])
  })
})

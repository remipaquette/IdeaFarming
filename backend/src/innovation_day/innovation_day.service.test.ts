import {
  transitionInnovationDayStatus,
  assertTeamJoinAllowed,
  type InnovationDayRow,
  type InnovationDayStatus,
} from './innovation_day.service'

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pool } = require('../db') as { pool: { query: jest.Mock } }

beforeEach(() => {
  pool.query.mockReset()
})

const makeRow = (overrides: Partial<InnovationDayRow> = {}): InnovationDayRow => ({
  id: 1,
  name: 'Q1 2025 Innovation Day',
  date: '2025-03-15',
  description: 'Our quarterly innovation event',
  team_size_cap: 5,
  status: 'draft',
  created_at: new Date('2025-01-01'),
  ...overrides,
})

// ---------------------------------------------------------------------------
// Valid transitions
// ---------------------------------------------------------------------------

describe('transitionInnovationDayStatus — valid transitions', () => {
  it('transitions draft → open and notifies all active Employees', async () => {
    const current = makeRow({ status: 'draft' })
    const updated = makeRow({ status: 'open' })
    pool.query
      .mockResolvedValueOnce({ rows: [current] })  // getInnovationDayById
      .mockResolvedValueOnce({ rows: [updated] })  // UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] }) // SELECT employees
      .mockResolvedValue({ rows: [] })              // INSERT notification × 3

    const result = await transitionInnovationDayStatus(1, 'open')
    expect(result.status).toBe('open')

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCalls = calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    expect(notifCalls).toHaveLength(3)
    const recipients = notifCalls.map(([, params]) => (params as unknown[])[0])
    expect(recipients).toEqual(expect.arrayContaining([1, 2, 3]))
  })

  it('sends no notifications when there are no active Employees on draft → open', async () => {
    const current = makeRow({ status: 'draft' })
    const updated = makeRow({ status: 'open' })
    pool.query
      .mockResolvedValueOnce({ rows: [current] })
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [] }) // no employees

    await transitionInnovationDayStatus(1, 'open')

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCalls = calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    expect(notifCalls).toHaveLength(0)
  })

  it('notification type is innovation_day_open with innovation_day_id payload', async () => {
    const current = makeRow({ id: 7, status: 'draft' })
    const updated = makeRow({ id: 7, status: 'open' })
    pool.query
      .mockResolvedValueOnce({ rows: [current] })
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValue({ rows: [] })

    await transitionInnovationDayStatus(7, 'open')

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('innovation_day_open'),
    )
    expect(notifCall).toBeDefined()
    const payload = JSON.parse((notifCall![1] as unknown[])[1] as string)
    expect(payload).toMatchObject({ innovation_day_id: 7 })
  })

  it('transitions open → in_progress without sending notifications', async () => {
    const current = makeRow({ status: 'open' })
    const updated = makeRow({ status: 'in_progress' })
    pool.query
      .mockResolvedValueOnce({ rows: [current] }) // getInnovationDayById
      .mockResolvedValueOnce({ rows: [updated] }) // UPDATE
    const result = await transitionInnovationDayStatus(1, 'in_progress')
    expect(result.status).toBe('in_progress')

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCalls = calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    expect(notifCalls).toHaveLength(0)
  })

  it('transitions in_progress → completed and runs DELETE + UPDATE in transaction', async () => {
    const current = makeRow({ status: 'in_progress' })
    const completed = makeRow({ status: 'completed' })
    pool.query
      .mockResolvedValueOnce({ rows: [current] }) // getInnovationDayById
      .mockResolvedValueOnce({ rows: [] })         // BEGIN
      .mockResolvedValueOnce({ rowCount: 2 })      // DELETE zero-member challenges
      .mockResolvedValueOnce({ rows: [completed] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] })          // COMMIT

    const result = await transitionInnovationDayStatus(1, 'completed')
    expect(result.status).toBe('completed')

    const calls = pool.query.mock.calls as [string, unknown[]][]
    expect(calls[1][0]).toBe('BEGIN')
    expect(calls[4][0]).toBe('COMMIT')
  })
})

// ---------------------------------------------------------------------------
// Invalid (backward / non-sequential) transitions
// ---------------------------------------------------------------------------

describe('transitionInnovationDayStatus — invalid transitions', () => {
  const invalidTransitions: Array<[InnovationDayStatus, InnovationDayStatus]> = [
    ['draft', 'in_progress'],
    ['draft', 'completed'],
    ['open', 'draft'],
    ['open', 'completed'],
    ['in_progress', 'draft'],
    ['in_progress', 'open'],
    ['completed', 'draft'],
    ['completed', 'open'],
    ['completed', 'in_progress'],
  ]

  test.each(invalidTransitions)('rejects %s → %s', async (from, to) => {
    pool.query.mockResolvedValueOnce({ rows: [makeRow({ status: from })] })
    await expect(transitionInnovationDayStatus(1, to)).rejects.toThrow(
      `Cannot transition from ${from} to ${to}`,
    )
  })
})

// ---------------------------------------------------------------------------
// Empty Challenge pruning — fires only on the Completed transition
// ---------------------------------------------------------------------------

describe('empty Challenge pruning', () => {
  it('does NOT issue DELETE when transitioning to open', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeRow({ status: 'draft' })] })
      .mockResolvedValueOnce({ rows: [makeRow({ status: 'open' })] })
      .mockResolvedValueOnce({ rows: [] }) // SELECT employees (no employees → no notifications)
    await transitionInnovationDayStatus(1, 'open')
    const calls = pool.query.mock.calls as [string, unknown[]][]
    const deleteCall = calls.find(([sql]) => sql.includes('DELETE FROM challenges'))
    expect(deleteCall).toBeUndefined()
  })

  it('issues DELETE scoped to the Innovation Day when transitioning to completed', async () => {
    const current = makeRow({ status: 'in_progress' })
    const completed = makeRow({ status: 'completed' })
    pool.query
      .mockResolvedValueOnce({ rows: [current] })
      .mockResolvedValueOnce({ rows: [] })          // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 })       // DELETE
      .mockResolvedValueOnce({ rows: [completed] })
      .mockResolvedValueOnce({ rows: [] })           // COMMIT

    await transitionInnovationDayStatus(1, 'completed')

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const deleteCall = calls.find(([sql]) => sql.includes('DELETE FROM challenges'))
    expect(deleteCall).toBeDefined()
    // Only removes zero-member challenges (NOT EXISTS guard)
    expect(deleteCall![0]).toContain('NOT EXISTS')
    expect(deleteCall![0]).toContain('team_members')
    // Scoped to the correct Innovation Day
    expect(deleteCall![1]).toEqual([1])
  })
})

// ---------------------------------------------------------------------------
// Team join rejection when In Progress or Completed
// ---------------------------------------------------------------------------

describe('assertTeamJoinAllowed', () => {
  it('resolves without error when status is open', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeRow({ status: 'open' })] })
    await expect(assertTeamJoinAllowed(1)).resolves.toBeUndefined()
  })

  it('rejects when Innovation Day is in_progress', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeRow({ status: 'in_progress' })] })
    await expect(assertTeamJoinAllowed(1)).rejects.toThrow()
  })

  it('rejects when Innovation Day is completed', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeRow({ status: 'completed' })] })
    await expect(assertTeamJoinAllowed(1)).rejects.toThrow()
  })

  it('rejects when Innovation Day is still in draft', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeRow({ status: 'draft' })] })
    await expect(assertTeamJoinAllowed(1)).rejects.toThrow()
  })
})

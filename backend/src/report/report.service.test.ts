import {
  shareUpdate,
  updateReport,
} from './report.service'

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

const makeReportRow = (overrides: Partial<{ id: number; challenge_id: number }> = {}) => ({
  id: overrides.id ?? 42,
  challenge_id: overrides.challenge_id ?? 10,
  problem_description: '',
  expected_benefits: '',
  main_tasks: '',
  results: '',
  next_steps: '',
  created_at: new Date(),
  updated_at: new Date(),
})

const makeMemberRow = (employee_id: number) => ({ employee_id })

// ---------------------------------------------------------------------------
// shareUpdate — dispatches notifications to team members
// ---------------------------------------------------------------------------

describe('shareUpdate — notification dispatch', () => {
  it('sends a notification to every team member except the sender', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })            // getReportIdByChallengeId
      .mockResolvedValueOnce({                                    // SELECT team_members
        rows: [makeMemberRow(1), makeMemberRow(2), makeMemberRow(3)],
      })
      .mockResolvedValue({ rows: [] })                           // INSERT notifications ×2

    await shareUpdate(10, 1) // sender is employee 1

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCalls = calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    // Employees 2 and 3 get notified; sender (1) does not
    expect(notifCalls).toHaveLength(2)
    const recipients = notifCalls.map(([, params]) => (params as unknown[])[0])
    expect(recipients).toEqual(expect.arrayContaining([2, 3]))
    expect(recipients).not.toContain(1)
  })

  it('sends no notifications when the sender is the only team member', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })            // getReportIdByChallengeId
      .mockResolvedValueOnce({ rows: [makeMemberRow(5)] })       // SELECT team_members (only sender)

    await shareUpdate(10, 5)

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCalls = calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    expect(notifCalls).toHaveLength(0)
  })

  it('notification payload contains challenge_id and report_id', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({ rows: [makeMemberRow(1), makeMemberRow(2)] })
      .mockResolvedValue({ rows: [] })

    await shareUpdate(10, 1)

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    expect(notifCall).toBeDefined()
    const payloadArg = (notifCall![1] as unknown[])[1] as string
    const payload = JSON.parse(payloadArg)
    expect(payload).toMatchObject({ challenge_id: 10, report_id: 42 })
  })

  it('notification type is report_update_shared', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({ rows: [makeMemberRow(1), makeMemberRow(7)] })
      .mockResolvedValue({ rows: [] })

    await shareUpdate(10, 1)

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    expect(notifCall![0]).toContain('report_update_shared')
  })

  it('throws when Report is not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }) // report not found

    await expect(shareUpdate(99, 1)).rejects.toThrow('Report not found')
  })
})

// ---------------------------------------------------------------------------
// updateReport — silent save does NOT trigger notifications
// ---------------------------------------------------------------------------

describe('updateReport — silent save', () => {
  it('does NOT insert any notifications when saving Report fields', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })            // UPDATE reports
      .mockResolvedValueOnce({ rows: [makeReportRow()] })  // getReportByChallengeId SELECT
      .mockResolvedValue({ rows: [] })                // refs queries

    await updateReport(10, {
      problem_description: 'desc',
      expected_benefits: 'benefits',
      main_tasks: 'tasks',
      results: 'results',
      next_steps: 'next',
    })

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCalls = calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('notifications'),
    )
    expect(notifCalls).toHaveLength(0)
  })

  it('issues an UPDATE to the reports table with all five fields', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeReportRow()] })
      .mockResolvedValue({ rows: [] })

    await updateReport(10, {
      problem_description: 'problem',
      expected_benefits: 'benefits',
      main_tasks: 'tasks',
      results: 'results',
      next_steps: 'next',
    })

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const updateCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.toUpperCase().startsWith('UPDATE REPORTS'),
    )
    expect(updateCall).toBeDefined()
    const params = updateCall![1] as unknown[]
    expect(params).toContain('problem')
    expect(params).toContain('benefits')
    expect(params).toContain('tasks')
    expect(params).toContain('results')
    expect(params).toContain('next')
  })
})

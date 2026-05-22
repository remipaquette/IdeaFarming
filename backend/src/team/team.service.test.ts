import { joinTeam, leaveTeam } from './team.service'

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

const makeChallengeRow = (overrides: Partial<{
  id: number
  innovation_day_id: number
  innovation_day_status: string
  team_size_cap: number
  current_member_count: number
}> = {}) => ({
  id: 10,
  innovation_day_id: 5,
  innovation_day_status: 'open',
  team_size_cap: 3,
  current_member_count: 0,
  ...overrides,
})

const makeMemberRow = (employee_id: number) => ({ employee_id })

// ---------------------------------------------------------------------------
// joinTeam — happy path
// ---------------------------------------------------------------------------

describe('joinTeam — happy path', () => {
  it('inserts a team_members row when Challenge is open and Employee is not already on a Team', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow()] })     // getChallengeWithDayInfo
      .mockResolvedValueOnce({ rows: [] })                       // no existing membership
      .mockResolvedValueOnce({ rows: [] })                       // INSERT team_members

    await expect(
      joinTeam({ challenge_id: 10, employee_id: 7 }),
    ).resolves.toBeUndefined()

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const insertCall = calls.find(([sql]) => sql.includes('INSERT INTO team_members'))
    expect(insertCall).toBeDefined()
    expect(insertCall![1]).toEqual([10, 7])
  })

  it('does NOT send notifications when Team is not yet full after join', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow({ current_member_count: 1, team_size_cap: 3 })] })
      .mockResolvedValueOnce({ rows: [] })   // no existing membership
      .mockResolvedValueOnce({ rows: [] })   // INSERT

    await joinTeam({ challenge_id: 10, employee_id: 7 })

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) => sql.includes('notifications'))
    expect(notifCall).toBeUndefined()
  })

  it('notifies ALL team members when the Team reaches the size cap', async () => {
    // cap = 3, current = 2 → after join newCount = 3 = cap → full
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow({ current_member_count: 2, team_size_cap: 3 })] })
      .mockResolvedValueOnce({ rows: [] })   // no existing membership
      .mockResolvedValueOnce({ rows: [] })   // INSERT team_members
      // SELECT team_members for notification fan-out (3 members including new one)
      .mockResolvedValueOnce({ rows: [makeMemberRow(1), makeMemberRow(2), makeMemberRow(7)] })
      // INSERT notification × 3
      .mockResolvedValue({ rows: [] })

    await joinTeam({ challenge_id: 10, employee_id: 7 })

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCalls = calls.filter(([sql]) => sql.includes('notifications'))
    // One notification per team member (3)
    expect(notifCalls).toHaveLength(3)
    const recipients = notifCalls.map(([, params]) => (params as unknown[])[0])
    expect(recipients).toEqual(expect.arrayContaining([1, 2, 7]))
  })

  it('notification payload contains challenge_id and innovation_day_id', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow({ id: 10, innovation_day_id: 5, current_member_count: 2, team_size_cap: 3 })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeMemberRow(7)] })
      .mockResolvedValue({ rows: [] })

    await joinTeam({ challenge_id: 10, employee_id: 7 })

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) => sql.includes('notifications'))!
    const payload = JSON.parse(notifCall[1][1] as string)
    expect(payload.challenge_id).toBe(10)
    expect(payload.innovation_day_id).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// joinTeam — Innovation Day status rejections
// ---------------------------------------------------------------------------

describe('joinTeam — Innovation Day status rejections', () => {
  it('rejects when Innovation Day is in_progress', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [makeChallengeRow({ innovation_day_status: 'in_progress' })],
    })
    await expect(joinTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'Team roster is locked',
    )
  })

  it('rejects when Innovation Day is completed', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [makeChallengeRow({ innovation_day_status: 'completed' })],
    })
    await expect(joinTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'Team roster is locked',
    )
  })

  it('rejects when Innovation Day is still in draft', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [makeChallengeRow({ innovation_day_status: 'draft' })],
    })
    await expect(joinTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'Innovation Day is not yet Open',
    )
  })
})

// ---------------------------------------------------------------------------
// joinTeam — duplicate membership rejection
// ---------------------------------------------------------------------------

describe('joinTeam — duplicate membership', () => {
  it('rejects when Employee is already on a Team for this Innovation Day', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow()] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // existing team_members row

    await expect(joinTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'You are already on a Team for this Innovation Day',
    )
  })

  it('checks membership across ALL Challenges for the Innovation Day, not just this one', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow({ id: 10, innovation_day_id: 5 })] })
      .mockResolvedValueOnce({ rows: [{ id: 55 }] }) // existing membership on a different challenge

    await expect(joinTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'You are already on a Team for this Innovation Day',
    )

    const calls = pool.query.mock.calls as [string, unknown[]][]
    // The membership check query should be scoped to innovation_day_id, not challenge_id
    const membershipCheckCall = calls[1]
    expect(membershipCheckCall[1]).toEqual([5, 7])
  })
})

// ---------------------------------------------------------------------------
// joinTeam — team size cap enforcement
// ---------------------------------------------------------------------------

describe('joinTeam — team size cap', () => {
  it('rejects when Team is already at the size cap', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow({ current_member_count: 3, team_size_cap: 3 })] })
      .mockResolvedValueOnce({ rows: [] }) // no existing membership

    await expect(joinTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'Team is full',
    )
  })

  it('rejects when Team exceeds the size cap (defensive)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeChallengeRow({ current_member_count: 5, team_size_cap: 3 })] })
      .mockResolvedValueOnce({ rows: [] })

    await expect(joinTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'Team is full',
    )
  })
})

// ---------------------------------------------------------------------------
// joinTeam — Challenge not found
// ---------------------------------------------------------------------------

describe('joinTeam — Challenge not found', () => {
  it('rejects when Challenge does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    await expect(joinTeam({ challenge_id: 999, employee_id: 7 })).rejects.toThrow(
      'Challenge not found',
    )
  })
})

// ---------------------------------------------------------------------------
// leaveTeam — happy path
// ---------------------------------------------------------------------------

describe('leaveTeam — happy path', () => {
  it('removes the team_members row when Innovation Day is open and Employee is a member', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 10, innovation_day_id: 5, innovation_day_status: 'open' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // DELETE

    await expect(
      leaveTeam({ challenge_id: 10, employee_id: 7 }),
    ).resolves.toBeUndefined()

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const deleteCall = calls.find(([sql]) => sql.includes('DELETE FROM team_members'))
    expect(deleteCall).toBeDefined()
    expect(deleteCall![1]).toEqual([10, 7])
  })
})

// ---------------------------------------------------------------------------
// leaveTeam — Innovation Day status rejections
// ---------------------------------------------------------------------------

describe('leaveTeam — Innovation Day status rejections', () => {
  it('rejects when Innovation Day is in_progress', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 10, innovation_day_id: 5, innovation_day_status: 'in_progress' }],
    })
    await expect(leaveTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'Team roster is locked',
    )
  })

  it('rejects when Innovation Day is completed', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 10, innovation_day_id: 5, innovation_day_status: 'completed' }],
    })
    await expect(leaveTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'Team roster is locked',
    )
  })
})

// ---------------------------------------------------------------------------
// leaveTeam — not a member
// ---------------------------------------------------------------------------

describe('leaveTeam — not a member', () => {
  it('rejects when Employee is not on the Team', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 10, innovation_day_id: 5, innovation_day_status: 'open' }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // DELETE matched nothing

    await expect(leaveTeam({ challenge_id: 10, employee_id: 7 })).rejects.toThrow(
      'You are not a member of this Team',
    )
  })
})

// ---------------------------------------------------------------------------
// leaveTeam — Challenge not found
// ---------------------------------------------------------------------------

describe('leaveTeam — Challenge not found', () => {
  it('rejects when Challenge does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    await expect(leaveTeam({ challenge_id: 999, employee_id: 7 })).rejects.toThrow(
      'Challenge not found',
    )
  })
})

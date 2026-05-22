import { promoteIdea, setChallengeFeatured } from './challenge.service'

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pool } = require('../db') as { pool: { query: jest.Mock } }

beforeEach(() => {
  pool.query.mockReset()
})

// Helpers to build realistic DB row responses
const makeIdeaRow = (overrides: { archived?: boolean; submitter_id?: number } = {}) => ({
  id: 10,
  submitter_id: overrides.submitter_id ?? 1,
  archived: overrides.archived ?? false,
})

const makeDayRow = (status = 'open') => ({ id: 5, status })

const makeChallengeDetail = () => ({
  id: 99,
  idea_id: 10,
  idea_title: 'Smarter onboarding',
  idea_description: 'Reduce ramp time for new hires.',
  innovation_day_id: 5,
  innovation_day_name: 'Q2 2026',
  innovation_day_date: '2026-06-15',
  innovation_day_status: 'open',
  challenge_type: 'implementation_of_improvements',
  framing: null,
  featured: false,
  team_member_count: 0,
  created_at: new Date(),
})

// ---------------------------------------------------------------------------
// Happy path — successful promotion
// ---------------------------------------------------------------------------

describe('promoteIdea — happy path', () => {
  it('inserts a Challenge and returns the detail when idea is active and day is open', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeIdeaRow()] })          // SELECT idea
      .mockResolvedValueOnce({ rows: [makeDayRow('open')] })     // SELECT innovation_day
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })             // INSERT challenge
      .mockResolvedValueOnce({ rows: [] })                       // INSERT report
      .mockResolvedValueOnce({ rows: [] })                       // INSERT notification (promoter ≠ author)
      .mockResolvedValueOnce({ rows: [makeChallengeDetail()] })  // getChallengeById

    const result = await promoteIdea({
      idea_id: 10,
      innovation_day_id: 5,
      challenge_type: 'implementation_of_improvements',
      framing: null,
      promoted_by: 2, // different from submitter_id 1 → notification fires
    })

    expect(result.id).toBe(99)
    expect(result.idea_id).toBe(10)
  })

  it('sends notification to Idea author when promoter is different', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeIdeaRow({ submitter_id: 1 })] })
      .mockResolvedValueOnce({ rows: [makeDayRow('open')] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [] })                       // INSERT report
      .mockResolvedValueOnce({ rows: [] })                       // INSERT notification
      .mockResolvedValueOnce({ rows: [makeChallengeDetail()] })

    await promoteIdea({
      idea_id: 10,
      innovation_day_id: 5,
      challenge_type: 'implementation_of_improvements',
      framing: null,
      promoted_by: 2,
    })

    // Find the notification INSERT call
    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) => typeof sql === 'string' && sql.includes('notifications'))
    expect(notifCall).toBeDefined()
    expect(notifCall![1][0]).toBe(1) // employee_id = submitter_id
  })

  it('does NOT send notification when promoter is the Idea author', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeIdeaRow({ submitter_id: 2 })] })
      .mockResolvedValueOnce({ rows: [makeDayRow('open')] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [] })                       // INSERT report
      .mockResolvedValueOnce({ rows: [makeChallengeDetail()] })

    await promoteIdea({
      idea_id: 10,
      innovation_day_id: 5,
      challenge_type: 'implementation_of_improvements',
      framing: null,
      promoted_by: 2, // same as submitter_id
    })

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) => typeof sql === 'string' && sql.includes('notifications'))
    expect(notifCall).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Rejection — archived Idea
// ---------------------------------------------------------------------------

describe('promoteIdea — archived Idea rejection', () => {
  it('rejects when the Idea is archived', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeIdeaRow({ archived: true })] })

    await expect(
      promoteIdea({
        idea_id: 10,
        innovation_day_id: 5,
        challenge_type: 'implementation_of_improvements',
        framing: null,
        promoted_by: 2,
      }),
    ).rejects.toThrow('Cannot promote an archived Idea')
  })

  it('rejects when the Idea is not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    await expect(
      promoteIdea({
        idea_id: 999,
        innovation_day_id: 5,
        challenge_type: 'implementation_of_improvements',
        framing: null,
        promoted_by: 2,
      }),
    ).rejects.toThrow('Idea not found')
  })
})

// ---------------------------------------------------------------------------
// Rejection — Innovation Day not in Open state
// ---------------------------------------------------------------------------

describe('promoteIdea — Innovation Day state validation', () => {
  const nonOpenStatuses = ['draft', 'in_progress', 'completed'] as const

  test.each(nonOpenStatuses)('rejects when Innovation Day is %s', async (status) => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeIdeaRow()] })
      .mockResolvedValueOnce({ rows: [makeDayRow(status)] })

    await expect(
      promoteIdea({
        idea_id: 10,
        innovation_day_id: 5,
        challenge_type: 'implementation_of_improvements',
        framing: null,
        promoted_by: 2,
      }),
    ).rejects.toThrow('Innovation Day is not Open')
  })

  it('rejects when Innovation Day is not found', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeIdeaRow()] })
      .mockResolvedValueOnce({ rows: [] })

    await expect(
      promoteIdea({
        idea_id: 10,
        innovation_day_id: 999,
        challenge_type: 'implementation_of_improvements',
        framing: null,
        promoted_by: 2,
      }),
    ).rejects.toThrow('Innovation Day not found')
  })
})

// ---------------------------------------------------------------------------
// Rejection — duplicate (same Idea + same Innovation Day)
// ---------------------------------------------------------------------------

describe('promoteIdea — duplicate rejection', () => {
  it('rejects when the same Idea is already a Challenge on the same Innovation Day', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate key value'), { code: '23505' })

    pool.query
      .mockResolvedValueOnce({ rows: [makeIdeaRow()] })
      .mockResolvedValueOnce({ rows: [makeDayRow('open')] })
      .mockRejectedValueOnce(uniqueViolation)

    await expect(
      promoteIdea({
        idea_id: 10,
        innovation_day_id: 5,
        challenge_type: 'implementation_of_improvements',
        framing: null,
        promoted_by: 2,
      }),
    ).rejects.toThrow('This Idea is already a Challenge on this Innovation Day')
  })
})

// ---------------------------------------------------------------------------
// Multiple Innovation Days — the same Idea can be promoted to different days
// ---------------------------------------------------------------------------

describe('promoteIdea — multiple Innovation Days', () => {
  it('succeeds for the same Idea on a different Innovation Day', async () => {
    const detailForDay7 = { ...makeChallengeDetail(), innovation_day_id: 7 }

    pool.query
      .mockResolvedValueOnce({ rows: [makeIdeaRow()] })
      .mockResolvedValueOnce({ rows: [makeDayRow('open')] })
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })
      .mockResolvedValueOnce({ rows: [] })                 // INSERT report
      .mockResolvedValueOnce({ rows: [] })                 // notification
      .mockResolvedValueOnce({ rows: [detailForDay7] })

    const result = await promoteIdea({
      idea_id: 10,
      innovation_day_id: 7,
      challenge_type: 'experimentation_and_exploration',
      framing: 'Explore a new approach',
      promoted_by: 2,
    })

    expect(result.innovation_day_id).toBe(7)
  })
})
// ---------------------------------------------------------------------------
// setChallengeFeatured — happy paths
// ---------------------------------------------------------------------------

describe('setChallengeFeatured — happy path', () => {
  it('marks a Challenge as Featured when its Innovation Day is Completed', async () => {
    const completedChallenge = { ...makeChallengeDetail(), innovation_day_status: 'completed', featured: false }
    const featuredChallenge = { ...completedChallenge, featured: true }

    pool.query
      .mockResolvedValueOnce({ rows: [completedChallenge] }) // getChallengeById (current)
      .mockResolvedValueOnce({ rows: [] })                   // UPDATE
      .mockResolvedValueOnce({ rows: [featuredChallenge] })  // getChallengeById (updated)

    const result = await setChallengeFeatured(99, true)
    expect(result.featured).toBe(true)
  })

  it('removes Featured status from a Challenge', async () => {
    const featuredChallenge = { ...makeChallengeDetail(), innovation_day_status: 'completed', featured: true }
    const unfeaturedChallenge = { ...featuredChallenge, featured: false }

    pool.query
      .mockResolvedValueOnce({ rows: [featuredChallenge] })   // getChallengeById (current)
      .mockResolvedValueOnce({ rows: [] })                    // UPDATE
      .mockResolvedValueOnce({ rows: [unfeaturedChallenge] }) // getChallengeById (updated)

    const result = await setChallengeFeatured(99, false)
    expect(result.featured).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// setChallengeFeatured — rejection: Innovation Day not Completed
// ---------------------------------------------------------------------------

describe('setChallengeFeatured — Innovation Day state validation', () => {
  const nonCompletedStatuses = ['draft', 'open', 'in_progress'] as const

  test.each(nonCompletedStatuses)(
    'rejects when Innovation Day is %s',
    async (status) => {
      const nonCompletedChallenge = { ...makeChallengeDetail(), innovation_day_status: status }

      pool.query
        .mockResolvedValueOnce({ rows: [nonCompletedChallenge] }) // getChallengeById

      await expect(setChallengeFeatured(99, true)).rejects.toThrow(
        'Can only feature a Challenge when its Innovation Day is Completed',
      )
    },
  )
})

// ---------------------------------------------------------------------------
// setChallengeFeatured — rejection: Challenge not found
// ---------------------------------------------------------------------------

describe('setChallengeFeatured — not found', () => {
  it('rejects when the Challenge does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }) // getChallengeById returns nothing

    await expect(setChallengeFeatured(999, true)).rejects.toThrow('Challenge not found')
  })
})
import {
  getRatingAggregate,
  getMyRating,
  toggleBusinessImpact,
  toggleEffortRequired,
} from './rating.service'

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pool } = require('../db') as { pool: { query: jest.Mock } }

beforeEach(() => {
  pool.query.mockReset()
})

// ---------------------------------------------------------------------------
// getRatingAggregate
// ---------------------------------------------------------------------------

describe('getRatingAggregate', () => {
  it('returns correct aggregate when ratings exist', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          avg_impact: '3.50',
          impact_count: '4',
          low_count: '1',
          medium_count: '2',
          high_count: '1',
        },
      ],
    })

    const result = await getRatingAggregate(1)

    expect(result.avg_business_impact).toBe(3.5)
    expect(result.impact_rater_count).toBe(4)
    expect(result.effort_distribution).toEqual({ low: 1, medium: 2, high: 1 })
  })

  it('returns null avg_business_impact when no impact ratings exist', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          avg_impact: null,
          impact_count: '0',
          low_count: '3',
          medium_count: '0',
          high_count: '0',
        },
      ],
    })

    const result = await getRatingAggregate(1)

    expect(result.avg_business_impact).toBeNull()
    expect(result.impact_rater_count).toBe(0)
    expect(result.effort_distribution.low).toBe(3)
  })

  it('returns all-zero distribution when no ratings at all', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          avg_impact: null,
          impact_count: '0',
          low_count: '0',
          medium_count: '0',
          high_count: '0',
        },
      ],
    })

    const result = await getRatingAggregate(42)

    expect(result.avg_business_impact).toBeNull()
    expect(result.impact_rater_count).toBe(0)
    expect(result.effort_distribution).toEqual({ low: 0, medium: 0, high: 0 })
  })
})

// ---------------------------------------------------------------------------
// getMyRating — per-user isolation
// ---------------------------------------------------------------------------

describe('getMyRating', () => {
  it("returns the requesting employee's own rating", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ business_impact: 5, effort_required: 'high' }],
    })

    const result = await getMyRating(1, 42)

    // Query must be scoped to this specific employee
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('employee_id = $2'),
      [1, 42],
    )
    expect(result.business_impact).toBe(5)
    expect(result.effort_required).toBe('high')
  })

  it('returns nulls when the employee has not rated the idea', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const result = await getMyRating(1, 99)

    expect(result.business_impact).toBeNull()
    expect(result.effort_required).toBeNull()
  })

  it("employee A's rating is independent from employee B's", async () => {
    // Employee A has a rating
    pool.query.mockResolvedValueOnce({
      rows: [{ business_impact: 4, effort_required: 'low' }],
    })
    const ratingA = await getMyRating(1, 1)

    // Employee B has a different rating — a separate DB call
    pool.query.mockResolvedValueOnce({
      rows: [{ business_impact: 1, effort_required: 'high' }],
    })
    const ratingB = await getMyRating(1, 2)

    expect(ratingA.business_impact).toBe(4)
    expect(ratingB.business_impact).toBe(1)
    expect(ratingA.business_impact).not.toBe(ratingB.business_impact)
  })
})

// ---------------------------------------------------------------------------
// toggleBusinessImpact — toggle behaviour
// ---------------------------------------------------------------------------

describe('toggleBusinessImpact', () => {
  it('sets business_impact when employee has no existing rating', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // getMyRating: no existing rating
      .mockResolvedValueOnce({ rows: [] }) // upsert

    const result = await toggleBusinessImpact(1, 1, 3)

    expect(result.business_impact).toBe(3)
  })

  it('removes business_impact (toggle off) when same value submitted again', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ business_impact: 3, effort_required: null }] })
      .mockResolvedValueOnce({ rows: [] }) // upsert

    const result = await toggleBusinessImpact(1, 1, 3)

    expect(result.business_impact).toBeNull()
  })

  it('changes business_impact when a different value is submitted', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ business_impact: 2, effort_required: null }] })
      .mockResolvedValueOnce({ rows: [] }) // upsert

    const result = await toggleBusinessImpact(1, 1, 5)

    expect(result.business_impact).toBe(5)
  })

  it('does not affect effort_required (axis independence)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ business_impact: 2, effort_required: 'medium' }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await toggleBusinessImpact(1, 1, 4)

    expect(result.effort_required).toBe('medium')
  })
})

// ---------------------------------------------------------------------------
// toggleEffortRequired — toggle behaviour
// ---------------------------------------------------------------------------

describe('toggleEffortRequired', () => {
  it('sets effort_required when employee has no existing rating', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await toggleEffortRequired(1, 1, 'low')

    expect(result.effort_required).toBe('low')
  })

  it('removes effort_required (toggle off) when same value submitted again', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ business_impact: null, effort_required: 'high' }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await toggleEffortRequired(1, 1, 'high')

    expect(result.effort_required).toBeNull()
  })

  it('changes effort_required when a different value is submitted', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ business_impact: null, effort_required: 'low' }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await toggleEffortRequired(1, 1, 'medium')

    expect(result.effort_required).toBe('medium')
  })

  it('does not affect business_impact (axis independence)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ business_impact: 4, effort_required: 'low' }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await toggleEffortRequired(1, 1, 'low')

    expect(result.business_impact).toBe(4)
  })
})

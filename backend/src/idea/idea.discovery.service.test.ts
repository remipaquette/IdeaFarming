import { listIdeas, type IdeaRow } from './idea.service'

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pool } = require('../db') as { pool: { query: jest.Mock } }

beforeEach(() => {
  pool.query.mockReset()
})

const mockIdea: IdeaRow = {
  id: 1,
  title: 'Reduce energy waste',
  description: 'Switch off unused servers at night',
  category_id: 2,
  category_name: 'Tech Debt',
  submitter_id: 10,
  submitter_email: 'alice@example.com',
  anonymous: false,
  image_url: null,
  archived: false,
  is_promoted: false,
  has_featured_challenge: false,
  created_at: new Date('2024-03-01'),
  updated_at: new Date('2024-03-01'),
  avg_business_impact: 4.0,
  impact_rater_count: 5,
  comment_count: 3,
}

function mockQueryPair(ideas: IdeaRow[], total: number): void {
  pool.query
    .mockResolvedValueOnce({ rows: ideas })
    .mockResolvedValueOnce({ rows: [{ count: String(total) }] })
}

// ---------------------------------------------------------------------------
// Default behaviour
// ---------------------------------------------------------------------------

describe('listIdeas — default behaviour', () => {
  it('excludes archived Ideas by default (archivedFilter = active)', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20 })
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('i.archived = FALSE'),
      expect.any(Array),
    )
  })

  it('returns ideas and total from query results', async () => {
    const idea2 = { ...mockIdea, id: 2 }
    mockQueryPair([mockIdea, idea2], 2)
    const result = await listIdeas({ page: 1, limit: 20 })
    expect(result.total).toBe(2)
    expect(result.ideas).toHaveLength(2)
    expect(result.ideas[0].id).toBe(1)
    expect(result.ideas[1].id).toBe(2)
  })

  it('applies page and limit as LIMIT/OFFSET', async () => {
    mockQueryPair([], 0)
    await listIdeas({ page: 3, limit: 10 })
    // page 3 with limit 10 → offset 20
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([10, 20]),
    )
  })
})

// ---------------------------------------------------------------------------
// Archived filter
// ---------------------------------------------------------------------------

describe('listIdeas — archived filter', () => {
  it('returns only archived Ideas when archivedFilter is archived', async () => {
    mockQueryPair([{ ...mockIdea, archived: true }], 1)
    await listIdeas({ page: 1, limit: 20, archivedFilter: 'archived' })
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('i.archived = TRUE'),
      expect.any(Array),
    )
  })

  it('omits archived condition when archivedFilter is all', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, archivedFilter: 'all' })
    // Check the count query (simple SELECT COUNT FROM ideas i) — no IDEA_QUERY SELECT noise
    const countQuery = (pool.query.mock.calls as [string, unknown[]][])[1][0]
    expect(countQuery).not.toContain('i.archived')
  })
})

// ---------------------------------------------------------------------------
// Full-text search
// ---------------------------------------------------------------------------

describe('listIdeas — full-text search', () => {
  it('filters by keyword using plainto_tsquery on search_vector', async () => {
    mockQueryPair([], 0)
    await listIdeas({ page: 1, limit: 20, search: 'cost reduction' })
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("plainto_tsquery('english'"),
      expect.arrayContaining(['cost reduction']),
    )
  })

  it('trims whitespace from search term before passing to query', async () => {
    mockQueryPair([], 0)
    await listIdeas({ page: 1, limit: 20, search: '  automation  ' })
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['automation']),
    )
  })

  it('omits search condition when search is empty string', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, search: '' })
    const calls = pool.query.mock.calls as [string, unknown[]][]
    expect(calls[0][0]).not.toContain('plainto_tsquery')
  })
})

// ---------------------------------------------------------------------------
// Category filter
// ---------------------------------------------------------------------------

describe('listIdeas — category filter', () => {
  it('filters by category_id', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, categoryId: 3 })
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('i.category_id ='),
      expect.arrayContaining([3]),
    )
  })

  it('omits category condition when categoryId is undefined', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20 })
    // Count query has no IDEA_QUERY SELECT noise — safe to check absence of category filter
    const countQuery = (pool.query.mock.calls as [string, unknown[]][])[1][0]
    expect(countQuery).not.toContain('category_id')
  })
})

// ---------------------------------------------------------------------------
// Promotion status filter
// ---------------------------------------------------------------------------

describe('listIdeas — promotion status filter', () => {
  it('filters promoted Ideas using EXISTS subquery', async () => {
    mockQueryPair([{ ...mockIdea, is_promoted: true }], 1)
    await listIdeas({ page: 1, limit: 20, promoted: true })
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('EXISTS (SELECT 1 FROM challenges'),
      expect.any(Array),
    )
  })

  it('filters not-yet-promoted Ideas using NOT EXISTS subquery', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, promoted: false })
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
      expect.any(Array),
    )
  })

  it('omits promotion condition when promoted is undefined', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20 })
    // Count query has no lateral joins — safe to check absence of EXISTS filter
    const countQuery = (pool.query.mock.calls as [string, unknown[]][])[1][0]
    expect(countQuery).not.toContain('EXISTS')
  })
})

// ---------------------------------------------------------------------------
// Sort orders
// ---------------------------------------------------------------------------

describe('listIdeas — sort orders', () => {
  it('sorts by newest (default) using i.created_at DESC', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, sort: 'newest' })
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('i.created_at DESC'),
      expect.any(Array),
    )
  })

  it('sorts by highest_impact using avg_business_impact DESC NULLS LAST', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, sort: 'highest_impact' })
    const dataQuery = (pool.query.mock.calls as [string, unknown[]][])[0][0]
    expect(dataQuery).toContain('avg_business_impact DESC NULLS LAST')
  })

  it('sorts by most_discussed using comment_count DESC', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, sort: 'most_discussed' })
    const dataQuery = (pool.query.mock.calls as [string, unknown[]][])[0][0]
    expect(dataQuery).toContain('comment_count DESC')
  })

  it('quick_win sort includes effort lateral join and composite Low Effort × High Impact formula', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, sort: 'quick_win' })
    const dataQuery = (pool.query.mock.calls as [string, unknown[]][])[0][0]
    // Effort lateral join must be present
    expect(dataQuery).toContain('low_effort_count')
    expect(dataQuery).toContain('total_effort_count')
    // Composite formula references both impact and effort ratio
    expect(dataQuery).toContain('avg_business_impact')
    expect(dataQuery).toContain('low_effort_count / effort.total_effort_count')
  })

  it('quick_win sort does not include effort join for other sort orders', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({ page: 1, limit: 20, sort: 'newest' })
    const dataQuery = (pool.query.mock.calls as [string, unknown[]][])[0][0]
    expect(dataQuery).not.toContain('low_effort_count')
  })
})

// ---------------------------------------------------------------------------
// Filters in combination
// ---------------------------------------------------------------------------

describe('listIdeas — combined filters', () => {
  it('applies search + category + promoted + sort simultaneously', async () => {
    mockQueryPair([mockIdea], 1)
    await listIdeas({
      page: 1,
      limit: 20,
      search: 'automation',
      categoryId: 2,
      promoted: true,
      sort: 'highest_impact',
    })
    const dataQuery = (pool.query.mock.calls as [string, unknown[]][])[0][0]
    expect(dataQuery).toContain("plainto_tsquery('english'")
    expect(dataQuery).toContain('i.category_id =')
    expect(dataQuery).toContain('EXISTS (SELECT 1 FROM challenges')
    expect(dataQuery).toContain('avg_business_impact DESC NULLS LAST')
  })

  it('applies archived filter together with search', async () => {
    mockQueryPair([], 0)
    await listIdeas({
      page: 1,
      limit: 20,
      search: 'legacy',
      archivedFilter: 'archived',
    })
    const dataQuery = (pool.query.mock.calls as [string, unknown[]][])[0][0]
    expect(dataQuery).toContain('i.archived = TRUE')
    expect(dataQuery).toContain("plainto_tsquery('english'")
  })
})

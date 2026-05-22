import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface IdeaView {
  id: number
  title: string
  description: string
  category_id: number
  category_name: string
  author: string
  image_url: string | null
  archived: boolean
  is_promoted: boolean
  has_featured_challenge: boolean
  created_at: string
  avg_business_impact: number | null
  impact_rater_count: number
  comment_count: number
}

interface Category {
  id: number
  name: string
}

type SortOrder = 'newest' | 'highest_impact' | 'most_discussed' | 'quick_win'
type ArchivedFilter = 'active' | 'archived' | 'all'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const PAGE_SIZE = 20

const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest',
  highest_impact: 'Highest Business Impact',
  most_discussed: 'Most Discussed',
  quick_win: 'Quick Win',
}

const ARCHIVED_LABELS: Record<ArchivedFilter, string> = {
  active: 'Active',
  archived: 'Archived',
  all: 'All',
}

export default function IdeaListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { employee } = useAuth()
  const isAdmin = employee?.role === 'admin'

  // Derive filter state from URL
  const search = searchParams.get('search') ?? ''
  const categoryId = searchParams.get('category_id')
    ? parseInt(searchParams.get('category_id')!, 10)
    : undefined
  const promotedParam = searchParams.get('promoted')
  const promoted =
    promotedParam === 'true' ? true : promotedParam === 'false' ? false : undefined
  const sort = (searchParams.get('sort') as SortOrder) ?? 'newest'
  const archivedFilter = (searchParams.get('archived') as ArchivedFilter) ?? 'active'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  // Local input state for debounced search
  const [searchInput, setSearchInput] = useState(search)
  const [ideas, setIdeas] = useState<IdeaView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  // Load categories once on mount
  useEffect(() => {
    fetch(`${API_BASE}/categories`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { categories?: Category[] } | null) => {
        if (data?.categories) setCategories(data.categories)
      })
      .catch(() => {})
  }, [])

  // Sync search input when URL changes (e.g. back/forward navigation)
  useEffect(() => {
    setSearchInput(search)
  }, [search])

  // Debounce search input → URL (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (searchInput.trim()) next.set('search', searchInput.trim())
          else next.delete('search')
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(timer)
    // setSearchParams is stable — only fire when searchInput changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Fetch ideas whenever URL-derived filters change
  useEffect(() => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    if (search.trim()) params.set('search', search.trim())
    if (categoryId !== undefined) params.set('category_id', String(categoryId))
    if (promoted !== undefined) params.set('promoted', String(promoted))
    if (sort !== 'newest') params.set('sort', sort)
    if (archivedFilter !== 'active') params.set('archived', archivedFilter)

    fetch(`${API_BASE}/ideas?${params.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load ideas')
        return res.json() as Promise<{ ideas: IdeaView[]; total: number }>
      })
      .then((data) => {
        setIdeas(data.ideas)
        setTotal(data.total)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load ideas'),
      )
      .finally(() => setLoading(false))
  }, [page, search, categoryId, promoted, sort, archivedFilter])

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value !== null && value !== '') next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  const goToPage = useCallback(
    (newPage: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('page', String(newPage))
        return next
      })
    },
    [setSearchParams],
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasActiveFilters =
    !!search.trim() || categoryId !== undefined || promoted !== undefined || sort !== 'newest'

  const pageTitle =
    archivedFilter === 'archived'
      ? 'Archived Ideas'
      : archivedFilter === 'all'
        ? 'All Ideas'
        : 'Ideas'

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">
              {pageTitle}
              {total > 0 && (
                <span className="ml-2 text-base font-normal text-muted-foreground">({total})</span>
              )}
            </h2>
            {archivedFilter === 'active' && (
              <button
                onClick={() => navigate('/ideas/new')}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                + Submit Idea
              </button>
            )}
          </div>

          {/* Search */}
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search ideas by title or description…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category filter */}
            <select
              value={categoryId ?? ''}
              onChange={(e) => setFilter('category_id', e.target.value || null)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Promotion status filter */}
            <select
              value={promoted === undefined ? '' : String(promoted)}
              onChange={(e) => setFilter('promoted', e.target.value || null)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Any status</option>
              <option value="true">Promoted to Innovation Day</option>
              <option value="false">Not yet promoted</option>
            </select>

            {/* Sort order */}
            <select
              value={sort}
              onChange={(e) =>
                setFilter('sort', e.target.value === 'newest' ? null : e.target.value)
              }
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.keys(SORT_LABELS) as SortOrder[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>

            {/* Admin: archived status filter */}
            {isAdmin && (
              <select
                value={archivedFilter}
                onChange={(e) =>
                  setFilter('archived', e.target.value === 'active' ? null : e.target.value)
                }
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.keys(ARCHIVED_LABELS) as ArchivedFilter[]).map((a) => (
                  <option key={a} value={a}>
                    {ARCHIVED_LABELS[a]}
                  </option>
                ))}
              </select>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchInput('')
                  setSearchParams(new URLSearchParams())
                }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading && <p className="text-muted-foreground">Loading ideas…</p>}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && ideas.length === 0 && (
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? 'No ideas match your search criteria.'
              : 'No ideas yet. Be the first to submit one!'}
          </p>
        )}

        <div className="space-y-3">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              onClick={() => navigate(`/ideas/${idea.id}`)}
              className="cursor-pointer rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground leading-snug">
                  {idea.title}
                </h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  {idea.has_featured_challenge && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      Featured
                    </span>
                  )}
                  {idea.is_promoted && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Promoted
                    </span>
                  )}
                  {idea.archived && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Archived
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {idea.category_name}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{idea.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{idea.author}</span>
                <span>·</span>
                <span>{new Date(idea.created_at).toLocaleDateString()}</span>
                {idea.avg_business_impact !== null && (
                  <>
                    <span>·</span>
                    <span className="text-yellow-500">
                      ★ {idea.avg_business_impact.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">({idea.impact_rater_count})</span>
                  </>
                )}
                {idea.comment_count > 0 && (
                  <>
                    <span>·</span>
                    <span>💬 {idea.comment_count}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              ← Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

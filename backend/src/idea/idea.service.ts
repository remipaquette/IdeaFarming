import { pool } from '../db'

export interface IdeaRow {
  id: number
  title: string
  description: string
  category_id: number
  category_name: string
  submitter_id: number
  submitter_email: string
  anonymous: boolean
  image_url: string | null
  archived: boolean
  is_promoted: boolean
  has_featured_challenge: boolean
  created_at: Date
  updated_at: Date
  avg_business_impact: number | null
  impact_rater_count: number
  comment_count: number
}

export interface IdeaView {
  id: number
  title: string
  description: string
  category_id: number
  category_name: string
  author: string
  is_own_idea: boolean
  anonymous: boolean
  image_url: string | null
  archived: boolean
  is_promoted: boolean
  has_featured_challenge: boolean
  created_at: Date
  updated_at: Date
  avg_business_impact: number | null
  impact_rater_count: number
  comment_count: number
}

export type IdeaSortOrder = 'newest' | 'highest_impact' | 'most_discussed' | 'quick_win'
export type ArchivedFilter = 'active' | 'archived' | 'all'

export interface IdeaDiscoveryParams {
  page: number
  limit: number
  search?: string
  categoryId?: number
  promoted?: boolean
  sort?: IdeaSortOrder
  archivedFilter?: ArchivedFilter
}

const IDEA_QUERY = `
  SELECT
    i.id,
    i.title,
    i.description,
    i.category_id,
    c.name   AS category_name,
    i.submitter_id,
    e.email  AS submitter_email,
    i.anonymous,
    i.image_url,
    i.archived,
    i.created_at,
    i.updated_at,
    r.avg_business_impact,
    COALESCE(r.impact_rater_count, 0)::INTEGER AS impact_rater_count,
    COALESCE(cc.comment_count, 0)::INTEGER AS comment_count,
    prom.is_promoted
  FROM ideas i
  JOIN categories c ON c.id = i.category_id
  JOIN employees  e ON e.id = i.submitter_id
  LEFT JOIN LATERAL (
    SELECT
      ROUND(AVG(business_impact)::NUMERIC, 2)::FLOAT AS avg_business_impact,
      COUNT(*) FILTER (WHERE business_impact IS NOT NULL) AS impact_rater_count
    FROM ratings
    WHERE idea_id = i.id
  ) r ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS comment_count
    FROM comments
    WHERE idea_id = i.id
  ) cc ON TRUE
  LEFT JOIN LATERAL (
    SELECT EXISTS (SELECT 1 FROM challenges WHERE idea_id = i.id) AS is_promoted
  ) prom ON TRUE
  LEFT JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM challenges WHERE idea_id = i.id AND featured = TRUE
    ) AS has_featured_challenge
  ) feat ON TRUE
`

export function toIdeaView(row: IdeaRow, requesterId: number, requesterRole: string): IdeaView {
  const isAdmin = requesterRole === 'admin'
  const isSubmitter = row.submitter_id === requesterId
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category_id: row.category_id,
    category_name: row.category_name,
    author: row.anonymous && !isAdmin ? 'Anonymous' : row.submitter_email,
    is_own_idea: isSubmitter,
    // Only submitter and admin know the anonymous flag's current state
    anonymous: isAdmin || isSubmitter ? row.anonymous : false,
    image_url: row.image_url,
    archived: row.archived,
    is_promoted: row.is_promoted,
    has_featured_challenge: row.has_featured_challenge,
    created_at: row.created_at,
    updated_at: row.updated_at,
    avg_business_impact: row.avg_business_impact ?? null,
    impact_rater_count: row.impact_rater_count ?? 0,
    comment_count: row.comment_count ?? 0,
  }
}

export async function getIdeaById(id: number): Promise<IdeaRow | null> {
  const { rows } = await pool.query<IdeaRow>(`${IDEA_QUERY} WHERE i.id = $1`, [id])
  return rows[0] ?? null
}

export async function createIdea(input: {
  title: string
  description: string
  category_id: number
  submitter_id: number
  anonymous: boolean
  image_url: string | null
}): Promise<IdeaRow> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO ideas (title, description, category_id, submitter_id, anonymous, image_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.title.trim(),
      input.description.trim(),
      input.category_id,
      input.submitter_id,
      input.anonymous,
      input.image_url,
    ],
  )
  const row = await getIdeaById(rows[0].id)
  if (!row) throw new Error('Failed to retrieve created idea')
  return row
}

export async function listIdeas(
  params: IdeaDiscoveryParams,
): Promise<{ ideas: IdeaRow[]; total: number }> {
  const {
    page,
    limit,
    search,
    categoryId,
    promoted,
    sort = 'newest',
    archivedFilter = 'active',
  } = params

  const offset = (page - 1) * limit
  const conditions: string[] = []
  const filterParams: unknown[] = []

  // Archived filter
  if (archivedFilter === 'active') conditions.push('i.archived = FALSE')
  else if (archivedFilter === 'archived') conditions.push('i.archived = TRUE')
  // 'all' has no archived condition

  // Category filter
  if (categoryId !== undefined) {
    filterParams.push(categoryId)
    conditions.push(`i.category_id = $${filterParams.length}`)
  }

  // Full-text search
  if (search && search.trim()) {
    filterParams.push(search.trim())
    conditions.push(`i.search_vector @@ plainto_tsquery('english', $${filterParams.length})`)
  }

  // Promotion status filter
  if (promoted === true) {
    conditions.push('EXISTS (SELECT 1 FROM challenges WHERE idea_id = i.id)')
  } else if (promoted === false) {
    conditions.push('NOT EXISTS (SELECT 1 FROM challenges WHERE idea_id = i.id)')
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Extra lateral join for Quick Win sort (effort distribution per idea)
  const effortJoin =
    sort === 'quick_win'
      ? `LEFT JOIN LATERAL (
           SELECT
             COUNT(*) FILTER (WHERE effort_required = 'low')::FLOAT AS low_effort_count,
             COUNT(*) FILTER (WHERE effort_required IS NOT NULL)::FLOAT AS total_effort_count
           FROM ratings
           WHERE idea_id = i.id
         ) effort ON TRUE`
      : ''

  // ORDER BY clause
  let orderBy: string
  switch (sort) {
    case 'highest_impact':
      orderBy = 'avg_business_impact DESC NULLS LAST, i.created_at DESC'
      break
    case 'most_discussed':
      orderBy = 'comment_count DESC, i.created_at DESC'
      break
    case 'quick_win':
      orderBy = `
        COALESCE(avg_business_impact, 0) *
          CASE WHEN effort.total_effort_count > 0
               THEN effort.low_effort_count / effort.total_effort_count
               ELSE 0 END
        DESC NULLS LAST,
        i.created_at DESC
      `
      break
    default: // newest
      orderBy = 'i.created_at DESC'
  }

  const dataParams = [...filterParams, limit, offset]
  const dataQuery = `
    ${IDEA_QUERY}
    ${effortJoin}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
  `

  const countQuery = `
    SELECT COUNT(*)::INTEGER AS count
    FROM ideas i
    ${whereClause}
  `

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<IdeaRow>(dataQuery, dataParams),
    pool.query<{ count: string }>(countQuery, filterParams),
  ])

  return { ideas: rows, total: parseInt(countRows[0].count, 10) }
}

export async function archiveIdea(id: number, requesterId: number, requesterRole: string): Promise<IdeaRow> {
  if (requesterRole !== 'admin') throw new Error('Forbidden')
  const existing = await getIdeaById(id)
  if (!existing) throw new Error('Idea not found')
  await pool.query(`UPDATE ideas SET archived = TRUE, updated_at = NOW() WHERE id = $1`, [id])
  return getIdeaById(id) as Promise<IdeaRow>
}

export async function unarchiveIdea(id: number, requesterId: number, requesterRole: string): Promise<IdeaRow> {
  if (requesterRole !== 'admin') throw new Error('Forbidden')
  const existing = await getIdeaById(id)
  if (!existing) throw new Error('Idea not found')
  await pool.query(`UPDATE ideas SET archived = FALSE, updated_at = NOW() WHERE id = $1`, [id])
  return getIdeaById(id) as Promise<IdeaRow>
}

/**
 * Used by the Challenge service to enforce that archived Ideas cannot be promoted.
 * Throws 'Idea is archived' if the Idea is archived.
 */
export async function assertIdeaNotArchived(id: number): Promise<void> {
  const row = await getIdeaById(id)
  if (!row) throw new Error('Idea not found')
  if (row.archived) throw new Error('Idea is archived')
}

export async function updateIdeaContent(
  id: number,
  requesterId: number,
  title: string,
  description: string,
): Promise<IdeaRow> {
  const existing = await getIdeaById(id)
  if (!existing) throw new Error('Idea not found')
  if (existing.submitter_id !== requesterId) throw new Error('Forbidden')

  await pool.query(
    `UPDATE ideas SET title = $1, description = $2, updated_at = NOW() WHERE id = $3`,
    [title.trim(), description.trim(), id],
  )
  return getIdeaById(id) as Promise<IdeaRow>
}

export async function removeAnonymousFlag(
  id: number,
  requesterId: number,
  requesterRole: string,
): Promise<IdeaRow> {
  const existing = await getIdeaById(id)
  if (!existing) throw new Error('Idea not found')

  const isAdmin = requesterRole === 'admin'
  const isSubmitter = existing.submitter_id === requesterId
  if (!isAdmin && !isSubmitter) throw new Error('Forbidden')

  await pool.query(
    `UPDATE ideas SET anonymous = FALSE, updated_at = NOW() WHERE id = $1`,
    [id],
  )
  return getIdeaById(id) as Promise<IdeaRow>
}

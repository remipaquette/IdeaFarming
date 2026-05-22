import { pool } from '../db'

export interface RatingAggregate {
  avg_business_impact: number | null
  impact_rater_count: number
  effort_distribution: {
    low: number
    medium: number
    high: number
  }
}

export interface MyRating {
  business_impact: number | null
  effort_required: 'low' | 'medium' | 'high' | null
}

export async function getRatingAggregate(ideaId: number): Promise<RatingAggregate> {
  const { rows } = await pool.query<{
    avg_impact: string | null
    impact_count: string
    low_count: string
    medium_count: string
    high_count: string
  }>(
    `SELECT
       ROUND(AVG(business_impact)::NUMERIC, 2)::TEXT AS avg_impact,
       COUNT(*) FILTER (WHERE business_impact IS NOT NULL) AS impact_count,
       COUNT(*) FILTER (WHERE effort_required = 'low')    AS low_count,
       COUNT(*) FILTER (WHERE effort_required = 'medium') AS medium_count,
       COUNT(*) FILTER (WHERE effort_required = 'high')   AS high_count
     FROM ratings
     WHERE idea_id = $1`,
    [ideaId],
  )
  const row = rows[0]
  return {
    avg_business_impact: row.avg_impact !== null ? parseFloat(row.avg_impact) : null,
    impact_rater_count: parseInt(row.impact_count, 10),
    effort_distribution: {
      low: parseInt(row.low_count, 10),
      medium: parseInt(row.medium_count, 10),
      high: parseInt(row.high_count, 10),
    },
  }
}

export async function getMyRating(ideaId: number, employeeId: number): Promise<MyRating> {
  const { rows } = await pool.query<{
    business_impact: number | null
    effort_required: 'low' | 'medium' | 'high' | null
  }>(
    `SELECT business_impact, effort_required
     FROM ratings
     WHERE idea_id = $1 AND employee_id = $2`,
    [ideaId, employeeId],
  )
  if (rows.length === 0) {
    return { business_impact: null, effort_required: null }
  }
  return rows[0]
}

/**
 * Toggle Business Impact rating for an Employee on an Idea.
 * If the current value equals the submitted value, the rating is removed (null).
 * Otherwise it is set to the new value.
 */
export async function toggleBusinessImpact(
  ideaId: number,
  employeeId: number,
  value: number,
): Promise<MyRating> {
  const current = await getMyRating(ideaId, employeeId)
  const newValue = current.business_impact === value ? null : value

  await pool.query(
    `INSERT INTO ratings (idea_id, employee_id, business_impact, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (idea_id, employee_id) DO UPDATE
     SET business_impact = $3, updated_at = NOW()`,
    [ideaId, employeeId, newValue],
  )

  return { business_impact: newValue, effort_required: current.effort_required }
}

/**
 * Toggle Effort Required rating for an Employee on an Idea.
 * If the current value equals the submitted value, the rating is removed (null).
 * Otherwise it is set to the new value.
 */
export async function toggleEffortRequired(
  ideaId: number,
  employeeId: number,
  value: 'low' | 'medium' | 'high',
): Promise<MyRating> {
  const current = await getMyRating(ideaId, employeeId)
  const newValue: 'low' | 'medium' | 'high' | null =
    current.effort_required === value ? null : value

  await pool.query(
    `INSERT INTO ratings (idea_id, employee_id, effort_required, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (idea_id, employee_id) DO UPDATE
     SET effort_required = $3, updated_at = NOW()`,
    [ideaId, employeeId, newValue],
  )

  return { business_impact: current.business_impact, effort_required: newValue }
}

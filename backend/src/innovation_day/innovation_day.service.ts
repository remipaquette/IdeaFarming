import { pool } from '../db'

export type InnovationDayStatus = 'draft' | 'open' | 'in_progress' | 'completed'

export type ChallengeType =
  | 'implementation_of_improvements'
  | 'experimentation_and_exploration'
  | 'problem_solving_and_brainstorming'

export interface InnovationDayRow {
  id: number
  name: string
  date: string
  description: string
  team_size_cap: number
  status: InnovationDayStatus
  created_at: Date
}

export interface ChallengeView {
  id: number
  idea_id: number
  idea_title: string
  challenge_type: ChallengeType
  framing: string | null
  featured: boolean
  team_member_count: number
  created_at: Date
}

// Only forward transitions are valid — backwards are rejected
const NEXT_STATUS: Readonly<Record<InnovationDayStatus, InnovationDayStatus | null>> = {
  draft: 'open',
  open: 'in_progress',
  in_progress: 'completed',
  completed: null,
}

export async function createInnovationDay(input: {
  name: string
  date: string
  description: string
  team_size_cap: number
}): Promise<InnovationDayRow> {
  const { rows } = await pool.query<InnovationDayRow>(
    `INSERT INTO innovation_days (name, date, description, team_size_cap, status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING *`,
    [input.name.trim(), input.date, input.description.trim(), input.team_size_cap],
  )
  return rows[0]
}

export async function getInnovationDayById(id: number): Promise<InnovationDayRow | null> {
  const { rows } = await pool.query<InnovationDayRow>(
    `SELECT * FROM innovation_days WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function listInnovationDays(isAdmin: boolean): Promise<InnovationDayRow[]> {
  const sql = isAdmin
    ? `SELECT * FROM innovation_days ORDER BY date DESC, id DESC`
    : `SELECT * FROM innovation_days WHERE status IN ('open', 'in_progress') ORDER BY date DESC, id DESC`
  const { rows } = await pool.query<InnovationDayRow>(sql)
  return rows
}

export async function updateInnovationDay(
  id: number,
  input: { name?: string; description?: string; team_size_cap?: number },
): Promise<InnovationDayRow> {
  const current = await getInnovationDayById(id)
  if (!current) throw new Error('Innovation Day not found')
  if (current.status !== 'draft' && current.status !== 'open') {
    throw new Error('Cannot update Innovation Day outside of Draft or Open state')
  }

  const name = input.name !== undefined ? input.name.trim() : current.name
  const description =
    input.description !== undefined ? input.description.trim() : current.description
  const team_size_cap =
    input.team_size_cap !== undefined ? input.team_size_cap : current.team_size_cap

  const { rows } = await pool.query<InnovationDayRow>(
    `UPDATE innovation_days
     SET name = $1, description = $2, team_size_cap = $3
     WHERE id = $4
     RETURNING *`,
    [name, description, team_size_cap, id],
  )
  if (!rows[0]) throw new Error('Innovation Day not found')
  return rows[0]
}

export async function transitionInnovationDayStatus(
  id: number,
  targetStatus: InnovationDayStatus,
): Promise<InnovationDayRow> {
  const current = await getInnovationDayById(id)
  if (!current) throw new Error('Innovation Day not found')
  if (NEXT_STATUS[current.status] !== targetStatus) {
    throw new Error(`Cannot transition from ${current.status} to ${targetStatus}`)
  }

  if (targetStatus === 'completed') {
    // Atomically prune zero-member Challenges and update status
    await pool.query('BEGIN')
    try {
      await pool.query(
        `DELETE FROM challenges
         WHERE innovation_day_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM team_members tm WHERE tm.challenge_id = challenges.id
           )`,
        [id],
      )
      const { rows } = await pool.query<InnovationDayRow>(
        `UPDATE innovation_days SET status = $1 WHERE id = $2 RETURNING *`,
        [targetStatus, id],
      )
      await pool.query('COMMIT')
      return rows[0]
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }
  }

  const { rows } = await pool.query<InnovationDayRow>(
    `UPDATE innovation_days SET status = $1 WHERE id = $2 RETURNING *`,
    [targetStatus, id],
  )
  if (!rows[0]) throw new Error('Innovation Day not found')

  // When transitioning to Open, notify all active Employees
  if (targetStatus === 'open') {
    const { rows: employees } = await pool.query<{ id: number }>(
      `SELECT id FROM employees WHERE is_active = TRUE`,
    )
    await Promise.all(
      employees.map((e) =>
        pool.query(
          `INSERT INTO notifications (employee_id, type, payload) VALUES ($1, 'innovation_day_open', $2::jsonb)`,
          [e.id, JSON.stringify({ innovation_day_id: id })],
        ),
      ),
    )
  }

  return rows[0]
}

export async function listChallengesForInnovationDay(
  innovationDayId: number,
): Promise<ChallengeView[]> {
  const { rows } = await pool.query<ChallengeView>(
    `SELECT
       c.id,
       c.idea_id,
       i.title          AS idea_title,
       c.challenge_type,
       c.framing,
       c.featured,
       COALESCE(tm.member_count, 0)::INTEGER AS team_member_count,
       c.created_at
     FROM challenges c
     JOIN ideas i ON i.id = c.idea_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INTEGER AS member_count
       FROM team_members
       WHERE challenge_id = c.id
     ) tm ON TRUE
     WHERE c.innovation_day_id = $1
     ORDER BY c.created_at ASC`,
    [innovationDayId],
  )
  return rows
}

// Used by the Team module to guard join/leave operations
export async function assertTeamJoinAllowed(innovationDayId: number): Promise<void> {
  const innovationDay = await getInnovationDayById(innovationDayId)
  if (!innovationDay) throw new Error('Innovation Day not found')
  if (innovationDay.status === 'in_progress' || innovationDay.status === 'completed') {
    throw new Error('Team roster is locked — Innovation Day is In Progress or Completed')
  }
  if (innovationDay.status === 'draft') {
    throw new Error('Innovation Day is not yet Open')
  }
}

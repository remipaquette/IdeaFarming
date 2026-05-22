import { pool } from '../db'

export interface ActivityIdea {
  id: number
  title: string
  status: 'active' | 'archived' | 'promoted'
}

export interface ActivityChallenge {
  challenge_id: number
  idea_id: number
  idea_title: string
  innovation_day_id: number
  innovation_day_name: string
  innovation_day_date: string
  challenge_type: string
}

export interface ActivityTeam {
  challenge_id: number
  idea_id: number
  idea_title: string
  innovation_day_id: number
  innovation_day_name: string
  challenge_type: string
  joined_at: Date
}

export interface ActivityInnovationDay {
  id: number
  name: string
  date: string
}

export interface MyActivity {
  ideas: ActivityIdea[]
  challenges: ActivityChallenge[]
  teams: ActivityTeam[]
  innovation_days: ActivityInnovationDay[]
}

export async function getMyActivity(employeeId: number): Promise<MyActivity> {
  // Ideas submitted by this Employee, with derived status
  const { rows: ideaRows } = await pool.query<{
    id: number
    title: string
    archived: boolean
    is_promoted: boolean
  }>(
    `SELECT
       i.id,
       i.title,
       i.archived,
       EXISTS (
         SELECT 1 FROM challenges c WHERE c.idea_id = i.id
       ) AS is_promoted
     FROM ideas i
     WHERE i.submitter_id = $1
     ORDER BY i.created_at DESC`,
    [employeeId],
  )

  const ideas: ActivityIdea[] = ideaRows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.archived ? 'archived' : row.is_promoted ? 'promoted' : 'active',
  }))

  // Challenges promoted by this Employee
  const { rows: challengeRows } = await pool.query<{
    challenge_id: number
    idea_id: number
    idea_title: string
    innovation_day_id: number
    innovation_day_name: string
    innovation_day_date: string
    challenge_type: string
  }>(
    `SELECT
       c.id          AS challenge_id,
       i.id          AS idea_id,
       i.title       AS idea_title,
       d.id          AS innovation_day_id,
       d.name        AS innovation_day_name,
       d.date::TEXT  AS innovation_day_date,
       c.challenge_type
     FROM challenges c
     JOIN ideas i         ON i.id = c.idea_id
     JOIN innovation_days d ON d.id = c.innovation_day_id
     WHERE c.promoted_by = $1
     ORDER BY c.created_at DESC`,
    [employeeId],
  )

  const challenges: ActivityChallenge[] = challengeRows

  // Teams the Employee has been a member of
  const { rows: teamRows } = await pool.query<{
    challenge_id: number
    idea_id: number
    idea_title: string
    innovation_day_id: number
    innovation_day_name: string
    challenge_type: string
    joined_at: Date
  }>(
    `SELECT
       c.id          AS challenge_id,
       i.id          AS idea_id,
       i.title       AS idea_title,
       d.id          AS innovation_day_id,
       d.name        AS innovation_day_name,
       c.challenge_type,
       tm.joined_at
     FROM team_members tm
     JOIN challenges c      ON c.id = tm.challenge_id
     JOIN ideas i           ON i.id = c.idea_id
     JOIN innovation_days d ON d.id = c.innovation_day_id
     WHERE tm.employee_id = $1
     ORDER BY tm.joined_at DESC`,
    [employeeId],
  )

  const teams: ActivityTeam[] = teamRows

  // Distinct Innovation Days the Employee participated in as a Team member
  const { rows: dayRows } = await pool.query<{
    id: number
    name: string
    date: string
  }>(
    `SELECT DISTINCT
       d.id,
       d.name,
       d.date::TEXT AS date
     FROM team_members tm
     JOIN challenges c      ON c.id = tm.challenge_id
     JOIN innovation_days d ON d.id = c.innovation_day_id
     WHERE tm.employee_id = $1
     ORDER BY d.date DESC`,
    [employeeId],
  )

  const innovation_days: ActivityInnovationDay[] = dayRows

  return { ideas, challenges, teams, innovation_days }
}

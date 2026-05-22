import { pool } from '../db'

export interface TeamMember {
  employee_id: number
  employee_email: string
  joined_at: Date
}

interface ChallengeWithDayInfo {
  id: number
  innovation_day_id: number
  innovation_day_status: string
  team_size_cap: number
  current_member_count: number
}

async function getChallengeWithDayInfo(challengeId: number): Promise<ChallengeWithDayInfo | null> {
  const { rows } = await pool.query<ChallengeWithDayInfo>(
    `SELECT
       c.id,
       c.innovation_day_id,
       d.status AS innovation_day_status,
       d.team_size_cap,
       COALESCE(tm.cnt, 0)::INTEGER AS current_member_count
     FROM challenges c
     JOIN innovation_days d ON d.id = c.innovation_day_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INTEGER AS cnt FROM team_members WHERE challenge_id = c.id
     ) tm ON TRUE
     WHERE c.id = $1`,
    [challengeId],
  )
  return rows[0] ?? null
}

function assertRosterUnlocked(status: string): void {
  if (status === 'in_progress' || status === 'completed') {
    throw new Error('Team roster is locked — Innovation Day is In Progress or Completed')
  }
  if (status === 'draft') {
    throw new Error('Innovation Day is not yet Open')
  }
}

export async function joinTeam(input: {
  challenge_id: number
  employee_id: number
}): Promise<void> {
  const challenge = await getChallengeWithDayInfo(input.challenge_id)
  if (!challenge) throw new Error('Challenge not found')

  assertRosterUnlocked(challenge.innovation_day_status)

  // Prevent joining more than one Team on the same Innovation Day
  const { rows: existingRows } = await pool.query<{ id: number }>(
    `SELECT tm.id
     FROM team_members tm
     JOIN challenges c ON c.id = tm.challenge_id
     WHERE c.innovation_day_id = $1 AND tm.employee_id = $2`,
    [challenge.innovation_day_id, input.employee_id],
  )
  if (existingRows.length > 0) {
    throw new Error('You are already on a Team for this Innovation Day')
  }

  if (challenge.current_member_count >= challenge.team_size_cap) {
    throw new Error('Team is full')
  }

  await pool.query(
    `INSERT INTO team_members (challenge_id, employee_id) VALUES ($1, $2)`,
    [input.challenge_id, input.employee_id],
  )

  const newCount = challenge.current_member_count + 1

  // Notify all Team members when the Team reaches the cap
  if (newCount >= challenge.team_size_cap) {
    const { rows: memberRows } = await pool.query<{ employee_id: number }>(
      `SELECT employee_id FROM team_members WHERE challenge_id = $1`,
      [input.challenge_id],
    )
    await Promise.all(
      memberRows.map((m) =>
        pool.query(
          `INSERT INTO notifications (employee_id, type, payload) VALUES ($1, 'team_full', $2::jsonb)`,
          [
            m.employee_id,
            JSON.stringify({
              challenge_id: input.challenge_id,
              innovation_day_id: challenge.innovation_day_id,
            }),
          ],
        ),
      ),
    )
  }
}

export async function leaveTeam(input: {
  challenge_id: number
  employee_id: number
}): Promise<void> {
  const { rows: challengeRows } = await pool.query<{
    id: number
    innovation_day_id: number
    innovation_day_status: string
  }>(
    `SELECT c.id, c.innovation_day_id, d.status AS innovation_day_status
     FROM challenges c
     JOIN innovation_days d ON d.id = c.innovation_day_id
     WHERE c.id = $1`,
    [input.challenge_id],
  )
  const challenge = challengeRows[0]
  if (!challenge) throw new Error('Challenge not found')

  assertRosterUnlocked(challenge.innovation_day_status)

  const { rowCount } = await pool.query(
    `DELETE FROM team_members WHERE challenge_id = $1 AND employee_id = $2`,
    [input.challenge_id, input.employee_id],
  )
  if (!rowCount || rowCount === 0) {
    throw new Error('You are not a member of this Team')
  }
}

export async function listTeamMembers(challengeId: number): Promise<TeamMember[]> {
  const { rows } = await pool.query<TeamMember>(
    `SELECT tm.employee_id, e.email AS employee_email, tm.joined_at
     FROM team_members tm
     JOIN employees e ON e.id = tm.employee_id
     WHERE tm.challenge_id = $1
     ORDER BY tm.joined_at ASC`,
    [challengeId],
  )
  return rows
}

import { pool } from '../db'
import type { ChallengeType } from '../innovation_day/innovation_day.service'

export type { ChallengeType }

export interface ChallengeDetail {
  id: number
  idea_id: number
  idea_title: string
  idea_description: string
  innovation_day_id: number
  innovation_day_name: string
  innovation_day_date: string
  innovation_day_status: string
  team_size_cap: number
  challenge_type: ChallengeType
  framing: string | null
  featured: boolean
  team_member_count: number
  created_at: Date
}

export interface ChallengeHistoryItem {
  id: number
  innovation_day_id: number
  innovation_day_name: string
  innovation_day_date: string
  innovation_day_status: string
  challenge_type: ChallengeType
  framing: string | null
  featured: boolean
  created_at: Date
}

export async function promoteIdea(input: {
  idea_id: number
  innovation_day_id: number
  challenge_type: ChallengeType
  framing: string | null
  promoted_by: number
}): Promise<ChallengeDetail> {
  // Validate the Idea exists and is not archived
  const { rows: ideaRows } = await pool.query<{
    id: number
    submitter_id: number
    archived: boolean
  }>(`SELECT id, submitter_id, archived FROM ideas WHERE id = $1`, [input.idea_id])
  const idea = ideaRows[0]
  if (!idea) throw new Error('Idea not found')
  if (idea.archived) throw new Error('Cannot promote an archived Idea')

  // Validate Innovation Day exists and is in Open state
  const { rows: dayRows } = await pool.query<{ id: number; status: string }>(
    `SELECT id, status FROM innovation_days WHERE id = $1`,
    [input.innovation_day_id],
  )
  const innovationDay = dayRows[0]
  if (!innovationDay) throw new Error('Innovation Day not found')
  if (innovationDay.status !== 'open') throw new Error('Innovation Day is not Open')

  // Insert challenge — unique constraint handles duplicate (idea+day)
  let challengeId: number
  try {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO challenges (idea_id, innovation_day_id, challenge_type, framing, promoted_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.idea_id,
        input.innovation_day_id,
        input.challenge_type,
        input.framing,
        input.promoted_by,
      ],
    )
    challengeId = rows[0].id
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      throw new Error('This Idea is already a Challenge on this Innovation Day')
    }
    throw err
  }

  // Create an empty Report for the new Challenge
  await pool.query(
    `INSERT INTO reports (challenge_id) VALUES ($1) ON CONFLICT (challenge_id) DO NOTHING`,
    [challengeId],
  )

  // Notify the Idea author if they are not the promoter
  if (idea.submitter_id !== input.promoted_by) {
    await pool.query(
      `INSERT INTO notifications (employee_id, type, payload)
       VALUES ($1, 'idea_promoted', $2::jsonb)`,
      [
        idea.submitter_id,
        JSON.stringify({
          idea_id: input.idea_id,
          challenge_id: challengeId,
          innovation_day_id: input.innovation_day_id,
        }),
      ],
    )
  }

  const challenge = await getChallengeById(challengeId)
  if (!challenge) throw new Error('Failed to retrieve created Challenge')
  return challenge
}

export async function getChallengeById(id: number): Promise<ChallengeDetail | null> {
  const { rows } = await pool.query<ChallengeDetail>(
    `SELECT
       c.id,
       c.idea_id,
       i.title           AS idea_title,
       i.description     AS idea_description,
       c.innovation_day_id,
       d.name            AS innovation_day_name,
       d.date::TEXT      AS innovation_day_date,
       d.status          AS innovation_day_status,
       d.team_size_cap,
       c.challenge_type,
       c.framing,
       c.featured,
       COALESCE(tm.member_count, 0)::INTEGER AS team_member_count,
       c.created_at
     FROM challenges c
     JOIN ideas i ON i.id = c.idea_id
     JOIN innovation_days d ON d.id = c.innovation_day_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INTEGER AS member_count
       FROM team_members
       WHERE challenge_id = c.id
     ) tm ON TRUE
     WHERE c.id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function searchChallenges(query: string, limit = 10): Promise<ChallengeDetail[]> {
  const { rows } = await pool.query<ChallengeDetail>(
    `SELECT
       c.id,
       c.idea_id,
       i.title           AS idea_title,
       i.description     AS idea_description,
       c.innovation_day_id,
       d.name            AS innovation_day_name,
       d.date::TEXT      AS innovation_day_date,
       d.status          AS innovation_day_status,
       d.team_size_cap,
       c.challenge_type,
       c.framing,
       c.featured,
       COALESCE(tm.member_count, 0)::INTEGER AS team_member_count,
       c.created_at
     FROM challenges c
     JOIN ideas i ON i.id = c.idea_id
     JOIN innovation_days d ON d.id = c.innovation_day_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INTEGER AS member_count
       FROM team_members
       WHERE challenge_id = c.id
     ) tm ON TRUE
     WHERE i.title ILIKE $1
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [`%${query}%`, limit],
  )
  return rows
}

export async function listChallengesForIdea(ideaId: number): Promise<ChallengeHistoryItem[]> {
  const { rows } = await pool.query<ChallengeHistoryItem>(
    `SELECT
       c.id,
       c.innovation_day_id,
       d.name       AS innovation_day_name,
       d.date::TEXT AS innovation_day_date,
       d.status     AS innovation_day_status,
       c.challenge_type,
       c.framing,
       c.featured,
       c.created_at
     FROM challenges c
     JOIN innovation_days d ON d.id = c.innovation_day_id
     WHERE c.idea_id = $1
     ORDER BY c.created_at DESC`,
    [ideaId],
  )
  return rows
}

export async function setChallengeFeatured(
  id: number,
  featured: boolean,
): Promise<ChallengeDetail> {
  // Verify Challenge exists and its Innovation Day is Completed
  const current = await getChallengeById(id)
  if (!current) throw new Error('Challenge not found')
  if (current.innovation_day_status !== 'completed') {
    throw new Error('Can only feature a Challenge when its Innovation Day is Completed')
  }

  await pool.query(`UPDATE challenges SET featured = $1 WHERE id = $2`, [featured, id])

  const updated = await getChallengeById(id)
  if (!updated) throw new Error('Challenge not found')
  return updated
}

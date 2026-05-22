import { pool } from '../db'

export interface IdeaRef {
  id: number
  idea_id: number
  idea_title: string
}

export interface ChallengeRef {
  id: number
  challenge_id: number
  idea_title: string
  innovation_day_name: string
}

export interface Report {
  id: number
  challenge_id: number
  problem_description: string
  expected_benefits: string
  main_tasks: string
  results: string
  next_steps: string
  created_at: Date
  updated_at: Date
  idea_refs: IdeaRef[]
  challenge_refs: ChallengeRef[]
}

export interface UpdateReportInput {
  problem_description: string
  expected_benefits: string
  main_tasks: string
  results: string
  next_steps: string
}

export async function getReportByChallengeId(challengeId: number): Promise<Report | null> {
  const { rows } = await pool.query<Omit<Report, 'idea_refs' | 'challenge_refs'>>(
    `SELECT id, challenge_id, problem_description, expected_benefits, main_tasks,
            results, next_steps, created_at, updated_at
     FROM reports
     WHERE challenge_id = $1`,
    [challengeId],
  )
  const report = rows[0]
  if (!report) return null

  const [ideaRefsResult, challengeRefsResult] = await Promise.all([
    pool.query<IdeaRef>(
      `SELECT rir.id, rir.idea_id, i.title AS idea_title
       FROM report_idea_refs rir
       JOIN ideas i ON i.id = rir.idea_id
       WHERE rir.report_id = $1
       ORDER BY rir.id`,
      [report.id],
    ),
    pool.query<ChallengeRef>(
      `SELECT rcr.id, rcr.challenge_id, i.title AS idea_title, d.name AS innovation_day_name
       FROM report_challenge_refs rcr
       JOIN challenges c ON c.id = rcr.challenge_id
       JOIN ideas i ON i.id = c.idea_id
       JOIN innovation_days d ON d.id = c.innovation_day_id
       WHERE rcr.report_id = $1
       ORDER BY rcr.id`,
      [report.id],
    ),
  ])

  return {
    ...report,
    idea_refs: ideaRefsResult.rows,
    challenge_refs: challengeRefsResult.rows,
  }
}

export async function createReportForChallenge(challengeId: number): Promise<void> {
  await pool.query(
    `INSERT INTO reports (challenge_id) VALUES ($1) ON CONFLICT (challenge_id) DO NOTHING`,
    [challengeId],
  )
}

export async function updateReport(
  challengeId: number,
  fields: UpdateReportInput,
): Promise<Report | null> {
  await pool.query(
    `UPDATE reports
     SET problem_description = $1,
         expected_benefits   = $2,
         main_tasks          = $3,
         results             = $4,
         next_steps          = $5,
         updated_at          = NOW()
     WHERE challenge_id = $6`,
    [
      fields.problem_description,
      fields.expected_benefits,
      fields.main_tasks,
      fields.results,
      fields.next_steps,
      challengeId,
    ],
  )
  return getReportByChallengeId(challengeId)
}

async function getReportIdByChallengeId(challengeId: number): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM reports WHERE challenge_id = $1`,
    [challengeId],
  )
  return rows[0]?.id ?? null
}

export async function addIdeaRef(challengeId: number, ideaId: number): Promise<void> {
  const reportId = await getReportIdByChallengeId(challengeId)
  if (!reportId) throw new Error('Report not found')

  const { rows: ideaRows } = await pool.query<{ id: number }>(
    `SELECT id FROM ideas WHERE id = $1`,
    [ideaId],
  )
  if (!ideaRows[0]) throw new Error('Idea not found')

  try {
    await pool.query(
      `INSERT INTO report_idea_refs (report_id, idea_id) VALUES ($1, $2)`,
      [reportId, ideaId],
    )
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return // already referenced — idempotent
    }
    throw err
  }
}

export async function removeIdeaRef(challengeId: number, ideaId: number): Promise<void> {
  const reportId = await getReportIdByChallengeId(challengeId)
  if (!reportId) throw new Error('Report not found')

  await pool.query(
    `DELETE FROM report_idea_refs WHERE report_id = $1 AND idea_id = $2`,
    [reportId, ideaId],
  )
}

export async function addChallengeRef(
  challengeId: number,
  refChallengeId: number,
): Promise<void> {
  const reportId = await getReportIdByChallengeId(challengeId)
  if (!reportId) throw new Error('Report not found')

  const { rows: challengeRows } = await pool.query<{ id: number }>(
    `SELECT id FROM challenges WHERE id = $1`,
    [refChallengeId],
  )
  if (!challengeRows[0]) throw new Error('Challenge not found')

  try {
    await pool.query(
      `INSERT INTO report_challenge_refs (report_id, challenge_id) VALUES ($1, $2)`,
      [reportId, refChallengeId],
    )
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return // already referenced — idempotent
    }
    throw err
  }
}

export async function removeChallengeRef(
  challengeId: number,
  refChallengeId: number,
): Promise<void> {
  const reportId = await getReportIdByChallengeId(challengeId)
  if (!reportId) throw new Error('Report not found')

  await pool.query(
    `DELETE FROM report_challenge_refs WHERE report_id = $1 AND challenge_id = $2`,
    [reportId, refChallengeId],
  )
}

export async function shareUpdate(challengeId: number, senderId: number): Promise<void> {
  const reportId = await getReportIdByChallengeId(challengeId)
  if (!reportId) throw new Error('Report not found')

  const { rows: members } = await pool.query<{ employee_id: number }>(
    `SELECT employee_id FROM team_members WHERE challenge_id = $1`,
    [challengeId],
  )

  const recipients = members.filter((m) => m.employee_id !== senderId)

  for (const recipient of recipients) {
    await pool.query(
      `INSERT INTO notifications (employee_id, type, payload)
       VALUES ($1, 'report_update_shared', $2::jsonb)`,
      [
        recipient.employee_id,
        JSON.stringify({ challenge_id: challengeId, report_id: reportId }),
      ],
    )
  }
}

export async function isTeamMember(
  challengeId: number,
  employeeId: number,
): Promise<boolean> {
  const { rows } = await pool.query<{ employee_id: number }>(
    `SELECT employee_id FROM team_members WHERE challenge_id = $1 AND employee_id = $2`,
    [challengeId, employeeId],
  )
  return rows.length > 0
}

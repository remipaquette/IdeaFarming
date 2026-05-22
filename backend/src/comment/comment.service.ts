import { pool } from '../db'

export interface CommentRow {
  id: number
  idea_id: number
  employee_id: number
  author_email: string
  parent_id: number | null
  body: string
  created_at: Date
}

export interface CommentView {
  id: number
  employee_id: number
  author: string
  body: string
  created_at: Date
  replies: CommentView[]
}

export async function listComments(ideaId: number): Promise<CommentView[]> {
  const { rows } = await pool.query<CommentRow>(
    `SELECT c.id, c.idea_id, c.employee_id, e.email AS author_email, c.parent_id, c.body, c.created_at
     FROM comments c
     JOIN employees e ON e.id = c.employee_id
     WHERE c.idea_id = $1
     ORDER BY c.created_at ASC`,
    [ideaId],
  )

  const topLevel = rows.filter((r) => r.parent_id === null)
  const replies = rows.filter((r) => r.parent_id !== null)

  return topLevel.map((c) => ({
    id: c.id,
    employee_id: c.employee_id,
    author: c.author_email,
    body: c.body,
    created_at: c.created_at,
    replies: replies
      .filter((r) => r.parent_id === c.id)
      .map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        author: r.author_email,
        body: r.body,
        created_at: r.created_at,
        replies: [],
      })),
  }))
}

export async function createComment(
  ideaId: number,
  employeeId: number,
  body: string,
  parentId?: number,
): Promise<CommentRow> {
  if (parentId !== undefined) {
    // Validate parent exists, belongs to this idea, and is a top-level comment (no reply-to-reply)
    const { rows: parentRows } = await pool.query<{ id: number; parent_id: number | null }>(
      `SELECT id, parent_id FROM comments WHERE id = $1 AND idea_id = $2`,
      [parentId, ideaId],
    )
    if (parentRows.length === 0) throw new Error('Parent comment not found')
    if (parentRows[0].parent_id !== null) throw new Error('Cannot reply to a reply')
  }

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO comments (idea_id, employee_id, parent_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [ideaId, employeeId, parentId ?? null, body.trim()],
  )

  const { rows: commentRows } = await pool.query<CommentRow>(
    `SELECT c.id, c.idea_id, c.employee_id, e.email AS author_email, c.parent_id, c.body, c.created_at
     FROM comments c
     JOIN employees e ON e.id = c.employee_id
     WHERE c.id = $1`,
    [rows[0].id],
  )
  const created = commentRows[0]

  if (parentId === undefined) {
    // Top-level comment: notify Idea author
    const { rows: ideaRows } = await pool.query<{ submitter_id: number }>(
      `SELECT submitter_id FROM ideas WHERE id = $1`,
      [ideaId],
    )
    const ideaAuthorId = ideaRows[0]?.submitter_id
    if (ideaAuthorId !== undefined && ideaAuthorId !== employeeId) {
      await pool.query(
        `INSERT INTO notifications (employee_id, type, payload)
         VALUES ($1, 'comment_on_idea', $2::jsonb)`,
        [ideaAuthorId, JSON.stringify({ idea_id: ideaId, comment_id: created.id })],
      )
    }
  } else {
    // Reply: notify parent comment author
    const { rows: parentCommentRows } = await pool.query<{ employee_id: number }>(
      `SELECT employee_id FROM comments WHERE id = $1`,
      [parentId],
    )
    const parentAuthorId = parentCommentRows[0]?.employee_id
    if (parentAuthorId !== undefined && parentAuthorId !== employeeId) {
      await pool.query(
        `INSERT INTO notifications (employee_id, type, payload)
         VALUES ($1, 'reply_on_comment', $2::jsonb)`,
        [parentAuthorId, JSON.stringify({ idea_id: ideaId, comment_id: created.id, parent_id: parentId })],
      )
    }
  }

  return created
}

export async function deleteComment(
  commentId: number,
  requesterId: number,
  requesterRole: string,
): Promise<void> {
  const { rows } = await pool.query<{ id: number; employee_id: number }>(
    `SELECT id, employee_id FROM comments WHERE id = $1`,
    [commentId],
  )
  if (rows.length === 0) throw new Error('Comment not found')
  const isAdmin = requesterRole === 'admin'
  const isAuthor = rows[0].employee_id === requesterId
  if (!isAdmin && !isAuthor) throw new Error('Forbidden')

  // ON DELETE CASCADE in the schema handles reply deletion when a parent is deleted
  await pool.query(`DELETE FROM comments WHERE id = $1`, [commentId])
}

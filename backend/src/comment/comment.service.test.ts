import { createComment } from './comment.service'

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pool } = require('../db') as { pool: { query: jest.Mock } }

beforeEach(() => {
  pool.query.mockReset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCommentRow = (overrides: Partial<{
  id: number
  idea_id: number
  employee_id: number
  parent_id: number | null
}> = {}) => ({
  id: overrides.id ?? 20,
  idea_id: overrides.idea_id ?? 5,
  employee_id: overrides.employee_id ?? 2,
  author_email: 'author@example.com',
  parent_id: overrides.parent_id ?? null,
  body: 'A comment',
  created_at: new Date(),
})

// ---------------------------------------------------------------------------
// Top-level comment — notifies Idea author
// ---------------------------------------------------------------------------

describe('createComment — top-level comment notification', () => {
  it('notifies the Idea author when commenter is different from author', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })              // INSERT comment RETURNING id
      .mockResolvedValueOnce({ rows: [makeCommentRow()] })         // SELECT comment row
      .mockResolvedValueOnce({ rows: [{ submitter_id: 1 }] })     // SELECT idea submitter_id (author=1)
      .mockResolvedValueOnce({ rows: [] })                         // INSERT notification

    await createComment(5, 2, 'Great idea!') // commenter=2, author=1

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('comment_on_idea'),
    )
    expect(notifCall).toBeDefined()
    // Recipient is the Idea author
    expect((notifCall![1] as unknown[])[0]).toBe(1)
  })

  it('does NOT notify when the commenter is the Idea author', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })
      .mockResolvedValueOnce({ rows: [makeCommentRow({ employee_id: 1 })] })
      .mockResolvedValueOnce({ rows: [{ submitter_id: 1 }] }) // author = commenter

    await createComment(5, 1, 'My own idea!') // commenter=1, author=1

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('comment_on_idea'),
    )
    expect(notifCall).toBeUndefined()
  })

  it('notification payload contains idea_id and comment_id', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })
      .mockResolvedValueOnce({ rows: [makeCommentRow({ id: 20, idea_id: 5 })] })
      .mockResolvedValueOnce({ rows: [{ submitter_id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })

    await createComment(5, 2, 'Notification test!')

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('comment_on_idea'),
    )
    expect(notifCall).toBeDefined()
    const payload = JSON.parse((notifCall![1] as unknown[])[1] as string)
    expect(payload).toMatchObject({ idea_id: 5, comment_id: 20 })
  })
})

// ---------------------------------------------------------------------------
// Reply — notifies parent comment author
// ---------------------------------------------------------------------------

describe('createComment — reply notification', () => {
  it('notifies the parent comment author when replier is different', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 10, parent_id: null }] }) // parent validation
      .mockResolvedValueOnce({ rows: [{ id: 21 }] })                  // INSERT RETURNING id
      .mockResolvedValueOnce({ rows: [makeCommentRow({ id: 21, parent_id: 10 })] }) // SELECT comment
      .mockResolvedValueOnce({ rows: [{ employee_id: 1 }] })           // SELECT parent comment author
      .mockResolvedValueOnce({ rows: [] })                             // INSERT notification

    await createComment(5, 2, 'Reply!', 10) // replier=2, parent author=1

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('reply_on_comment'),
    )
    expect(notifCall).toBeDefined()
    expect((notifCall![1] as unknown[])[0]).toBe(1) // recipient = parent comment author
  })

  it('does NOT notify when replier is the parent comment author', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 10, parent_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 21 }] })
      .mockResolvedValueOnce({ rows: [makeCommentRow({ id: 21, parent_id: 10 })] })
      .mockResolvedValueOnce({ rows: [{ employee_id: 2 }] }) // parent author = replier

    await createComment(5, 2, 'Replying to myself!', 10) // replier=2, parent author=2

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('reply_on_comment'),
    )
    expect(notifCall).toBeUndefined()
  })

  it('notification payload contains idea_id, comment_id, and parent_id', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 10, parent_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 21 }] })
      .mockResolvedValueOnce({ rows: [makeCommentRow({ id: 21, idea_id: 5, parent_id: 10 })] })
      .mockResolvedValueOnce({ rows: [{ employee_id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })

    await createComment(5, 2, 'Reply!', 10)

    const calls = pool.query.mock.calls as [string, unknown[]][]
    const notifCall = calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('reply_on_comment'),
    )
    expect(notifCall).toBeDefined()
    const payload = JSON.parse((notifCall![1] as unknown[])[1] as string)
    expect(payload).toMatchObject({ idea_id: 5, comment_id: 21, parent_id: 10 })
  })
})

import { pool } from '../db'

export interface Category {
  id: number
  name: string
  created_at: Date
}

export async function listCategories(): Promise<Category[]> {
  const { rows } = await pool.query<Category>(
    'SELECT id, name, created_at FROM categories ORDER BY name ASC',
  )
  return rows
}

export async function createCategory(name: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Category name cannot be empty')
  }
  try {
    const { rows } = await pool.query<Category>(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at',
      [trimmed],
    )
    return rows[0]
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('unique') || message.includes('duplicate')) {
      throw new Error('Category name already exists')
    }
    throw err
  }
}

export async function renameCategory(id: number, name: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Category name cannot be empty')
  }
  try {
    const { rows } = await pool.query<Category>(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
      [trimmed, id],
    )
    if (rows.length === 0) {
      throw new Error('Category not found')
    }
    return rows[0]
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('unique') || message.includes('duplicate')) {
      throw new Error('Category name already exists')
    }
    throw err
  }
}

export async function deleteCategory(id: number): Promise<void> {
  // Check if any Ideas are assigned to this Category.
  // The ideas table is created in Slice 4; if it doesn't exist yet,
  // no Ideas can be assigned, so deletion is safe.
  let ideaCount = 0
  try {
    const { rows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM ideas WHERE category_id = $1',
      [id],
    )
    ideaCount = parseInt(rows[0].count, 10)
  } catch {
    // ideas table not yet created; no Ideas can be assigned
    ideaCount = 0
  }

  if (ideaCount > 0) {
    throw new Error('Cannot delete a Category that has Ideas assigned to it')
  }

  const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id])
  if (rowCount === 0) {
    throw new Error('Category not found')
  }
}

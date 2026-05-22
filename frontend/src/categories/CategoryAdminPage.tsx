import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Navigate } from 'react-router-dom'

interface Category {
  id: number
  name: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function CategoryAdminPage() {
  const { employee } = useAuth()

  if (employee?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <CategoryAdminPanel />
}

function CategoryAdminPanel() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/categories`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load categories')
      const data = await res.json()
      setCategories(data.categories)
    } catch {
      setError('Could not load categories.')
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsCreating(true)
    try {
      const res = await fetch(`${API_BASE}/admin/categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not create category')
      }
      setNewName('')
      await loadCategories()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create category')
    } finally {
      setIsCreating(false)
    }
  }

  function startRename(category: Category) {
    setRenamingId(category.id)
    setRenameValue(category.name)
    setError(null)
  }

  async function handleRename(e: FormEvent, id: number) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not rename category')
      }
      setRenamingId(null)
      await loadCategories()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not rename category')
    }
  }

  async function handleDelete(id: number) {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not delete category')
      }
      await loadCategories()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete category')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Category Management</h1>

        {error && (
          <p role="alert" className="text-sm text-destructive border border-destructive/20 bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Create form */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            required
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={isCreating || !newName.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isCreating ? 'Adding…' : 'Add'}
          </button>
        </form>

        {/* Category list */}
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                {renamingId === cat.id ? (
                  <form
                    onSubmit={(e) => handleRename(e, cat.id)}
                    className="flex flex-1 gap-2"
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      required
                      autoFocus
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={!renameValue.trim()}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="rounded-md border border-input px-3 py-1 text-xs hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-foreground">{cat.name}</span>
                    <button
                      onClick={() => startRename(cat)}
                      className="rounded-md border border-input px-3 py-1 text-xs hover:bg-muted"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="rounded-md border border-destructive/50 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

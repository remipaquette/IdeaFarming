import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Navigate } from 'react-router-dom'
import { type InnovationDayStatus } from './InnovationDayListPage'

interface InnovationDayView {
  id: number
  name: string
  date: string
  description: string
  team_size_cap: number
  status: InnovationDayStatus
  created_at: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const STATUS_LABELS: Record<InnovationDayStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const NEXT_STATUS: Partial<Record<InnovationDayStatus, InnovationDayStatus>> = {
  draft: 'open',
  open: 'in_progress',
  in_progress: 'completed',
}

const NEXT_STATUS_LABELS: Partial<Record<InnovationDayStatus, string>> = {
  draft: 'Open to Employees',
  open: 'Start (In Progress)',
  in_progress: 'Complete Event',
}

export default function InnovationDayAdminPage() {
  const { employee } = useAuth()
  if (employee?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <InnovationDayAdminPanel />
}

function InnovationDayAdminPanel() {
  const navigate = useNavigate()
  const [innovationDays, setInnovationDays] = useState<InnovationDayView[]>([])
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTeamSizeCap, setNewTeamSizeCap] = useState('5')

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTeamSizeCap, setEditTeamSizeCap] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadInnovationDays()
  }, [])

  async function loadInnovationDays() {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/innovation-days`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setInnovationDays(data.innovation_days)
    } catch {
      setError('Could not load Innovation Days.')
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/admin/innovation-days`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          date: newDate,
          description: newDescription,
          team_size_cap: parseInt(newTeamSizeCap, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not create Innovation Day')
      }
      setNewName('')
      setNewDate('')
      setNewDescription('')
      setNewTeamSizeCap('5')
      await loadInnovationDays()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create Innovation Day')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(day: InnovationDayView) {
    setEditingId(day.id)
    setEditName(day.name)
    setEditDescription(day.description)
    setEditTeamSizeCap(String(day.team_size_cap))
    setError(null)
  }

  async function handleSaveEdit(e: FormEvent, id: number) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/innovation-days/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          team_size_cap: parseInt(editTeamSizeCap, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not save')
      }
      setEditingId(null)
      await loadInnovationDays()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function handleTransition(id: number, targetStatus: InnovationDayStatus) {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/admin/innovation-days/${id}/transition`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Transition failed')
      }
      await loadInnovationDays()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transition failed')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>
        )}

        {/* Create form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Innovation Day</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Q2 2025 Innovation Day"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Our quarterly innovation event..."
              />
            </div>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team size cap
                </label>
                <input
                  type="number"
                  min={1}
                  value={newTeamSizeCap}
                  onChange={(e) => setNewTeamSizeCap(e.target.value)}
                  required
                  className="w-24 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create (Draft)'}
              </button>
            </div>
          </form>
        </div>

        {/* Innovation Days list */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Innovation Days</h2>
        {innovationDays.length === 0 ? (
          <p className="text-gray-500">No Innovation Days yet.</p>
        ) : (
          <div className="space-y-4">
            {innovationDays.map((day) => (
              <div key={day.id} className="bg-white rounded-lg border border-gray-200 p-5">
                {editingId === day.id ? (
                  <form onSubmit={(e) => handleSaveEdit(e, day.id)} className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Team size cap
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editTeamSizeCap}
                          onChange={(e) => setEditTeamSizeCap(e.target.value)}
                          required
                          className="w-24 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{day.name}</h3>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {STATUS_LABELS[day.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(day.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}{' '}
                          &middot; Team size cap: {day.team_size_cap}
                        </p>
                        {day.description && (
                          <p className="text-sm text-gray-700 mt-1">{day.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Transition button */}
                        {NEXT_STATUS[day.status] && (
                          <button
                            onClick={() =>
                              handleTransition(day.id, NEXT_STATUS[day.status]!)
                            }
                            className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700"
                          >
                            {NEXT_STATUS_LABELS[day.status]}
                          </button>
                        )}
                        {/* Edit button — only for Draft and Open */}
                        {(day.status === 'draft' || day.status === 'open') && (
                          <button
                            onClick={() => startEdit(day)}
                            className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/innovation-days/${day.id}`)}
                          className="px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

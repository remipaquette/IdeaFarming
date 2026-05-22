import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export type InnovationDayStatus = 'draft' | 'open' | 'in_progress' | 'completed'

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

const STATUS_BADGE_CLASSES: Record<InnovationDayStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-purple-100 text-purple-800',
}

export default function InnovationDayListPage() {
  const navigate = useNavigate()

  const [innovationDays, setInnovationDays] = useState<InnovationDayView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInnovationDays()
  }, [])

  async function loadInnovationDays() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/innovation-days`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load Innovation Days')
      const data = await res.json()
      setInnovationDays(data.innovation_days)
    } catch {
      setError('Could not load Innovation Days.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Innovation Days</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : innovationDays.length === 0 ? (
          <p className="text-gray-500">No Innovation Days available.</p>
        ) : (
          <div className="space-y-4">
            {innovationDays.map((day) => (
              <div
                key={day.id}
                className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                onClick={() => navigate(`/innovation-days/${day.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{day.name}</h3>
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASSES[day.status]}`}
                      >
                        {STATUS_LABELS[day.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {new Date(day.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}{' '}
                      &middot; Team size cap: {day.team_size_cap}
                    </p>
                    {day.description && (
                      <p className="text-sm text-gray-700 line-clamp-2">{day.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

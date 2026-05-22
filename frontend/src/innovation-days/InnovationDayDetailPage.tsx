import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { type InnovationDayStatus } from './InnovationDayListPage'

type ChallengeType =
  | 'implementation_of_improvements'
  | 'experimentation_and_exploration'
  | 'problem_solving_and_brainstorming'

interface InnovationDayView {
  id: number
  name: string
  date: string
  description: string
  team_size_cap: number
  status: InnovationDayStatus
  created_at: string
}

interface ChallengeView {
  id: number
  idea_id: number
  idea_title: string
  challenge_type: ChallengeType
  framing: string | null
  featured: boolean
  team_member_count: number
  created_at: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const STATUS_LABELS: Record<InnovationDayStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  implementation_of_improvements: 'Implementation of Improvements',
  experimentation_and_exploration: 'Experimentation and Exploration',
  problem_solving_and_brainstorming: 'Problem-Solving and Brainstorming',
}

export default function InnovationDayDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const isAdmin = employee?.role === 'admin'

  const [innovationDay, setInnovationDay] = useState<InnovationDayView | null>(null)
  const [challenges, setChallenges] = useState<ChallengeView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    loadDetail(parseInt(id, 10))
  }, [id])

  async function loadDetail(dayId: number) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/innovation-days/${dayId}`, { credentials: 'include' })
      if (res.status === 403) {
        setError('You do not have permission to view this Innovation Day.')
        return
      }
      if (res.status === 404) {
        setError('Innovation Day not found.')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setInnovationDay(data.innovation_day)
      setChallenges(data.challenges)
    } catch {
      setError('Could not load Innovation Day.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error || !innovationDay) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-red-600">{error ?? 'Not found'}</p>
        <button
          onClick={() => navigate('/innovation-days')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Innovation Days
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/innovation-days')}
            className="text-sm text-blue-600 hover:underline mb-1"
          >
            ← Innovation Days
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <h2 className="text-2xl font-bold text-gray-900">{innovationDay.name}</h2>
            <span className="mt-1 text-sm font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {STATUS_LABELS[innovationDay.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {new Date(innovationDay.date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            &middot; Team size cap: {innovationDay.team_size_cap}
          </p>
          {innovationDay.description && (
            <p className="text-gray-700">{innovationDay.description}</p>
          )}
          {isAdmin && (
            <div className="mt-4">
              <button
                onClick={() => navigate('/admin/innovation-days')}
                className="text-sm text-blue-600 hover:underline"
              >
                Manage in Admin
              </button>
            </div>
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Challenges ({challenges.length})
        </h3>

        {challenges.length === 0 ? (
          <p className="text-gray-500">No Challenges yet for this Innovation Day.</p>
        ) : (
          <div className="space-y-3">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                onClick={() => navigate(`/challenges/${challenge.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {challenge.featured && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                          Featured
                        </span>
                      )}
                      <h4 className="font-medium text-gray-900 truncate">{challenge.idea_title}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      {CHALLENGE_TYPE_LABELS[challenge.challenge_type]}
                    </p>
                    {challenge.framing && (
                      <p className="text-sm text-gray-700 line-clamp-2">{challenge.framing}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-sm text-gray-500">
                    {challenge.team_member_count} / {innovationDay.team_size_cap} members
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

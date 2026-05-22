import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type IdeaStatus = 'active' | 'archived' | 'promoted'

type ChallengeType =
  | 'implementation_of_improvements'
  | 'experimentation_and_exploration'
  | 'problem_solving_and_brainstorming'

interface ActivityIdea {
  id: number
  title: string
  status: IdeaStatus
}

interface ActivityChallenge {
  challenge_id: number
  idea_id: number
  idea_title: string
  innovation_day_id: number
  innovation_day_name: string
  innovation_day_date: string
  challenge_type: ChallengeType
}

interface ActivityTeam {
  challenge_id: number
  idea_id: number
  idea_title: string
  innovation_day_id: number
  innovation_day_name: string
  challenge_type: ChallengeType
  joined_at: string
}

interface ActivityInnovationDay {
  id: number
  name: string
  date: string
}

interface MyActivityData {
  ideas: ActivityIdea[]
  challenges: ActivityChallenge[]
  teams: ActivityTeam[]
  innovation_days: ActivityInnovationDay[]
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  active: 'Active',
  archived: 'Archived',
  promoted: 'Promoted to Event',
}

const IDEA_STATUS_BADGE: Record<IdeaStatus, string> = {
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
  promoted: 'bg-blue-100 text-blue-800',
}

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  implementation_of_improvements: 'Implementation of Improvements',
  experimentation_and_exploration: 'Experimentation and Exploration',
  problem_solving_and_brainstorming: 'Problem-Solving and Brainstorming',
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-lg font-semibold text-foreground mb-3">{title}</h3>
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground py-2">{message}</p>
}

export default function MyActivityPage() {
  const navigate = useNavigate()
  const { employee } = useAuth()
  const [activity, setActivity] = useState<MyActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!employee) return
    loadActivity(employee.id)
  }, [employee])

  async function loadActivity(employeeId: number) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/employees/${employeeId}/activity`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load activity')
      const data = await res.json() as { activity: MyActivityData }
      setActivity(data.activity)
    } catch {
      setError('Could not load your activity.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-foreground mb-8">My Activity</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : activity && (
          <div className="space-y-10">

            {/* My Ideas */}
            <section>
              <SectionHeader title="My Ideas" />
              {activity.ideas.length === 0 ? (
                <EmptyState message="You haven't submitted any Ideas yet." />
              ) : (
                <div className="space-y-2">
                  {activity.ideas.map((idea) => (
                    <div
                      key={idea.id}
                      className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                      onClick={() => navigate(`/ideas/${idea.id}`)}
                    >
                      <span className="text-sm font-medium text-foreground">{idea.title}</span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${IDEA_STATUS_BADGE[idea.status]}`}
                      >
                        {IDEA_STATUS_LABELS[idea.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Challenges I Promoted */}
            <section>
              <SectionHeader title="Challenges I Promoted" />
              {activity.challenges.length === 0 ? (
                <EmptyState message="You haven't promoted any Challenges yet." />
              ) : (
                <div className="space-y-2">
                  {activity.challenges.map((ch) => (
                    <div
                      key={ch.challenge_id}
                      className="flex items-start justify-between bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                      onClick={() => navigate(`/challenges/${ch.challenge_id}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ch.idea_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ch.innovation_day_name} &middot; {ch.innovation_day_date}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-4 shrink-0">
                        {CHALLENGE_TYPE_LABELS[ch.challenge_type]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* My Teams */}
            <section>
              <SectionHeader title="My Teams" />
              {activity.teams.length === 0 ? (
                <EmptyState message="You haven't joined any Teams yet." />
              ) : (
                <div className="space-y-2">
                  {activity.teams.map((team) => (
                    <div
                      key={team.challenge_id}
                      className="flex items-start justify-between bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                      onClick={() => navigate(`/challenges/${team.challenge_id}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{team.idea_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {team.innovation_day_name}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-4 shrink-0">
                        {CHALLENGE_TYPE_LABELS[team.challenge_type]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Innovation Days I Participated In */}
            <section>
              <SectionHeader title="Innovation Days I Participated In" />
              {activity.innovation_days.length === 0 ? (
                <EmptyState message="You haven't participated in any Innovation Days yet." />
              ) : (
                <div className="space-y-2">
                  {activity.innovation_days.map((day) => (
                    <div
                      key={day.id}
                      className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                      onClick={() => navigate(`/innovation-days/${day.id}`)}
                    >
                      <span className="text-sm font-medium text-foreground">{day.name}</span>
                      <span className="text-xs text-muted-foreground">{day.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </main>
    </div>
  )
}

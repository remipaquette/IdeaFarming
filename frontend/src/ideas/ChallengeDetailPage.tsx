import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type ChallengeType =
  | 'implementation_of_improvements'
  | 'experimentation_and_exploration'
  | 'problem_solving_and_brainstorming'

interface ChallengeDetail {
  id: number
  idea_id: number
  idea_title: string
  idea_description: string
  innovation_day_id: number
  innovation_day_name: string
  innovation_day_date: string
  innovation_day_status: string
  challenge_type: ChallengeType
  framing: string | null
  featured: boolean
  team_member_count: number
  team_size_cap: number
  created_at: string
}

interface TeamMember {
  employee_id: number
  employee_email: string
  joined_at: string
}

interface IdeaRef {
  id: number
  idea_id: number
  idea_title: string
}

interface ChallengeRef {
  id: number
  challenge_id: number
  idea_title: string
  innovation_day_name: string
}

interface Report {
  id: number
  challenge_id: number
  problem_description: string
  expected_benefits: string
  main_tasks: string
  results: string
  next_steps: string
  idea_refs: IdeaRef[]
  challenge_refs: ChallengeRef[]
}

interface IdeaSearchResult {
  id: number
  title: string
}

interface ChallengeSearchResult {
  id: number
  idea_title: string
  innovation_day_name: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  implementation_of_improvements: 'Implementation of Improvements',
  experimentation_and_exploration: 'Experimentation and Exploration',
  problem_solving_and_brainstorming: 'Problem-Solving and Brainstorming',
}

const emptyForm = {
  problem_description: '',
  expected_benefits: '',
  main_tasks: '',
  results: '',
  next_steps: '',
}

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teamActionError, setTeamActionError] = useState<string | null>(null)
  const [teamActionLoading, setTeamActionLoading] = useState(false)
  const [featureLoading, setFeatureLoading] = useState(false)
  const [featureError, setFeatureError] = useState<string | null>(null)

  // Report state
  const [report, setReport] = useState<Report | null>(null)
  const [reportForm, setReportForm] = useState(emptyForm)
  const [reportSaving, setReportSaving] = useState(false)
  const [reportSaveError, setReportSaveError] = useState<string | null>(null)
  const [reportSaved, setReportSaved] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState(false)

  // Idea ref search state
  const [ideaQuery, setIdeaQuery] = useState('')
  const [ideaResults, setIdeaResults] = useState<IdeaSearchResult[]>([])
  const [ideaSearchLoading, setIdeaSearchLoading] = useState(false)
  const ideaSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Challenge ref search state
  const [challengeQuery, setChallengeQuery] = useState('')
  const [challengeResults, setChallengeResults] = useState<ChallengeSearchResult[]>([])
  const [challengeSearchLoading, setChallengeSearchLoading] = useState(false)
  const challengeSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async (challengeId: string) => {
    try {
      const [challengeRes, membersRes, reportRes] = await Promise.all([
        fetch(`${API_BASE}/challenges/${challengeId}`, { credentials: 'include' }),
        fetch(`${API_BASE}/challenges/${challengeId}/team/members`, { credentials: 'include' }),
        fetch(`${API_BASE}/challenges/${challengeId}/report`, { credentials: 'include' }),
      ])
      if (challengeRes.status === 404) throw new Error('Challenge not found')
      if (!challengeRes.ok) throw new Error('Failed to load Challenge')
      const challengeData = await challengeRes.json()
      setChallenge(challengeData.challenge)
      if (membersRes.ok) {
        const membersData = await membersRes.json()
        setMembers(membersData.members)
      }
      if (reportRes.ok) {
        const reportData = await reportRes.json()
        const r: Report = reportData.report
        setReport(r)
        setReportForm({
          problem_description: r.problem_description,
          expected_benefits: r.expected_benefits,
          main_tasks: r.main_tasks,
          results: r.results,
          next_steps: r.next_steps,
        })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Challenge')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    loadData(id)
  }, [id, loadData])

  async function handleToggleFeatured() {
    if (!id || !challenge) return
    setFeatureLoading(true)
    setFeatureError(null)
    try {
      const res = await fetch(`${API_BASE}/admin/challenges/${id}/featured`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !challenge.featured }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to update Featured status')
      }
      const data = await res.json()
      setChallenge(data.challenge)
    } catch (err: unknown) {
      setFeatureError(err instanceof Error ? err.message : 'Failed to update Featured status')
    } finally {
      setFeatureLoading(false)
    }
  }

  async function handleJoin() {
    if (!id) return
    setTeamActionLoading(true)
    setTeamActionError(null)
    try {
      const res = await fetch(`${API_BASE}/challenges/${id}/team/join`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to join Team')
      }
      await loadData(id)
    } catch (err: unknown) {
      setTeamActionError(err instanceof Error ? err.message : 'Failed to join Team')
    } finally {
      setTeamActionLoading(false)
    }
  }

  async function handleLeave() {
    if (!id) return
    setTeamActionLoading(true)
    setTeamActionError(null)
    try {
      const res = await fetch(`${API_BASE}/challenges/${id}/team/leave`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to leave Team')
      }
      await loadData(id)
    } catch (err: unknown) {
      setTeamActionError(err instanceof Error ? err.message : 'Failed to leave Team')
    } finally {
      setTeamActionLoading(false)
    }
  }

  async function handleSaveReport() {
    if (!id) return
    setReportSaving(true)
    setReportSaveError(null)
    setReportSaved(false)
    try {
      const res = await fetch(`${API_BASE}/challenges/${id}/report`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save Report')
      }
      const data = await res.json()
      setReport(data.report)
      setReportSaved(true)
      setTimeout(() => setReportSaved(false), 3000)
    } catch (err: unknown) {
      setReportSaveError(err instanceof Error ? err.message : 'Failed to save Report')
    } finally {
      setReportSaving(false)
    }
  }

  async function handleShareUpdate() {
    if (!id) return
    setShareLoading(true)
    setShareError(null)
    setShareSuccess(false)
    try {
      const res = await fetch(`${API_BASE}/challenges/${id}/report/share`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to share update')
      }
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 3000)
    } catch (err: unknown) {
      setShareError(err instanceof Error ? err.message : 'Failed to share update')
    } finally {
      setShareLoading(false)
    }
  }

  function handleIdeaQueryChange(q: string) {
    setIdeaQuery(q)
    if (ideaSearchTimer.current) clearTimeout(ideaSearchTimer.current)
    if (!q.trim()) { setIdeaResults([]); return }
    ideaSearchTimer.current = setTimeout(async () => {
      setIdeaSearchLoading(true)
      try {
        const res = await fetch(
          `${API_BASE}/ideas?search=${encodeURIComponent(q)}&limit=10`,
          { credentials: 'include' },
        )
        if (res.ok) {
          const data = await res.json()
          setIdeaResults(
            (data.ideas as { id: number; title: string }[]).map((i) => ({
              id: i.id,
              title: i.title,
            })),
          )
        }
      } finally {
        setIdeaSearchLoading(false)
      }
    }, 300)
  }

  async function handleAddIdeaRef(ideaId: number) {
    if (!id) return
    const res = await fetch(`${API_BASE}/challenges/${id}/report/idea-refs`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea_id: ideaId }),
    })
    if (res.ok) {
      const data = await res.json()
      setReport(data.report)
      setIdeaQuery('')
      setIdeaResults([])
    }
  }

  async function handleRemoveIdeaRef(ideaId: number) {
    if (!id) return
    const res = await fetch(`${API_BASE}/challenges/${id}/report/idea-refs/${ideaId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      setReport((prev) =>
        prev ? { ...prev, idea_refs: prev.idea_refs.filter((r) => r.idea_id !== ideaId) } : prev,
      )
    }
  }

  function handleChallengeQueryChange(q: string) {
    setChallengeQuery(q)
    if (challengeSearchTimer.current) clearTimeout(challengeSearchTimer.current)
    if (!q.trim()) { setChallengeResults([]); return }
    challengeSearchTimer.current = setTimeout(async () => {
      setChallengeSearchLoading(true)
      try {
        const res = await fetch(
          `${API_BASE}/challenges?q=${encodeURIComponent(q)}`,
          { credentials: 'include' },
        )
        if (res.ok) {
          const data = await res.json()
          setChallengeResults(
            (data.challenges as { id: number; idea_title: string; innovation_day_name: string }[]).map(
              (c) => ({ id: c.id, idea_title: c.idea_title, innovation_day_name: c.innovation_day_name }),
            ),
          )
        }
      } finally {
        setChallengeSearchLoading(false)
      }
    }, 300)
  }

  async function handleAddChallengeRef(refChallengeId: number) {
    if (!id) return
    const res = await fetch(`${API_BASE}/challenges/${id}/report/challenge-refs`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: refChallengeId }),
    })
    if (res.ok) {
      const data = await res.json()
      setReport(data.report)
      setChallengeQuery('')
      setChallengeResults([])
    }
  }

  async function handleRemoveChallengeRef(refChallengeId: number) {
    if (!id) return
    const res = await fetch(
      `${API_BASE}/challenges/${id}/report/challenge-refs/${refChallengeId}`,
      { method: 'DELETE', credentials: 'include' },
    )
    if (res.ok) {
      setReport((prev) =>
        prev
          ? {
              ...prev,
              challenge_refs: prev.challenge_refs.filter((r) => r.challenge_id !== refChallengeId),
            }
          : prev,
      )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-red-600">{error ?? 'Not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-blue-600 hover:underline text-sm"
        >
          ← Go back
        </button>
      </div>
    )
  }

  const displayText = challenge.framing?.trim() || challenge.idea_description
  const isMember = employee ? members.some((m) => m.employee_id === employee.id) : false
  const isFull = challenge.team_member_count >= challenge.team_size_cap
  const isOpen = challenge.innovation_day_status === 'open'
  const isAdmin = employee?.role === 'admin'
  const isCompleted = challenge.innovation_day_status === 'completed'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(`/innovation-days/${challenge.innovation_day_id}`)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← {challenge.innovation_day_name}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Challenge header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{challenge.idea_title}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {CHALLENGE_TYPE_LABELS[challenge.challenge_type]}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {challenge.featured && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                  Featured
                </span>
              )}
              {isAdmin && isCompleted && (
                <button
                  onClick={handleToggleFeatured}
                  disabled={featureLoading}
                  className="text-sm px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {featureLoading
                    ? challenge.featured ? 'Removing…' : 'Featuring…'
                    : challenge.featured ? 'Unfeature' : 'Mark as Featured'}
                </button>
              )}
            </div>
          </div>
          {featureError && (
            <p className="text-sm text-red-600">{featureError}</p>
          )}

          {/* Innovation Day info */}
          <div className="rounded-md bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span className="font-medium text-gray-800">{challenge.innovation_day_name}</span>
            {' · '}
            {new Date(challenge.innovation_day_date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' · '}
            {challenge.team_member_count} / {challenge.team_size_cap} team{' '}
            {challenge.team_member_count === 1 ? 'member' : 'members'}
          </div>

          {/* Framing or Idea description fallback */}
          <div>
            {challenge.framing ? (
              <>
                <h2 className="text-sm font-semibold text-gray-700 mb-1">Challenge Framing</h2>
                <p className="text-gray-800 whitespace-pre-wrap">{displayText}</p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-gray-700 mb-1">
                  Idea Description{' '}
                  <span className="font-normal text-gray-400">(no framing provided)</span>
                </h2>
                <p className="text-gray-800 whitespace-pre-wrap">{displayText}</p>
              </>
            )}
          </div>

          {/* Link to original Idea */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => navigate(`/ideas/${challenge.idea_id}`)}
              className="text-sm text-blue-600 hover:underline"
            >
              View original Idea →
            </button>
          </div>
        </div>

        {/* Team section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Team{' '}
              <span className="text-sm font-normal text-gray-500">
                ({challenge.team_member_count} / {challenge.team_size_cap})
              </span>
            </h2>
            {isOpen && (
              isMember ? (
                <button
                  onClick={handleLeave}
                  disabled={teamActionLoading}
                  className="text-sm px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {teamActionLoading ? 'Leaving…' : 'Leave Team'}
                </button>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={teamActionLoading || isFull}
                  className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {teamActionLoading ? 'Joining…' : isFull ? 'Team Full' : 'Join Team'}
                </button>
              )
            )}
            {!isOpen && challenge.innovation_day_status === 'in_progress' && (
              <span className="text-xs text-gray-500">Roster locked (In Progress)</span>
            )}
          </div>

          {teamActionError && (
            <p className="text-sm text-red-600">{teamActionError}</p>
          )}

          {members.length === 0 ? (
            <p className="text-sm text-gray-500">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m) => (
                <li key={m.employee_id} className="py-2 flex items-center justify-between">
                  <span className="text-sm text-gray-800">
                    {m.employee_email}
                    {employee && m.employee_id === employee.id && (
                      <span className="ml-2 text-xs text-blue-600 font-medium">(you)</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">
                    Joined {new Date(m.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Report section */}
        {report && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Team Report</h2>
              {isMember && (
                <div className="flex items-center gap-2">
                  {shareSuccess && (
                    <span className="text-xs text-green-600 font-medium">Update shared!</span>
                  )}
                  {shareError && (
                    <span className="text-xs text-red-600">{shareError}</span>
                  )}
                  <button
                    onClick={handleShareUpdate}
                    disabled={shareLoading}
                    className="text-sm px-3 py-1.5 rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    {shareLoading ? 'Sharing…' : 'Share Update'}
                  </button>
                </div>
              )}
            </div>

            {/* Report fields */}
            <div className="space-y-4">
              {(
                [
                  { key: 'problem_description', label: 'Problem Description' },
                  { key: 'expected_benefits', label: 'Expected Benefits' },
                  { key: 'main_tasks', label: 'Main Tasks / Activities Performed' },
                  { key: 'results', label: 'Results' },
                  { key: 'next_steps', label: 'Next Steps' },
                ] as { key: keyof typeof reportForm; label: string }[]
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  {isMember ? (
                    <textarea
                      rows={4}
                      value={reportForm[key]}
                      onChange={(e) =>
                        setReportForm((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                      placeholder={`Enter ${label.toLowerCase()}…`}
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[2rem]">
                      {report[key] || <span className="text-gray-400 italic">Not filled in yet.</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Save button */}
            {isMember && (
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={handleSaveReport}
                  disabled={reportSaving}
                  className="text-sm px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {reportSaving ? 'Saving…' : 'Save Report'}
                </button>
                {reportSaved && (
                  <span className="text-xs text-green-600 font-medium">Saved!</span>
                )}
                {reportSaveError && (
                  <span className="text-xs text-red-600">{reportSaveError}</span>
                )}
              </div>
            )}

            {/* Related Ideas */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Related Ideas</h3>
              {report.idea_refs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No related Ideas added yet.</p>
              ) : (
                <ul className="space-y-1">
                  {report.idea_refs.map((ref) => (
                    <li key={ref.id} className="flex items-center justify-between text-sm">
                      <button
                        onClick={() => navigate(`/ideas/${ref.idea_id}`)}
                        className="text-blue-600 hover:underline text-left"
                      >
                        {ref.idea_title}
                      </button>
                      {isMember && (
                        <button
                          onClick={() => handleRemoveIdeaRef(ref.idea_id)}
                          className="ml-4 text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isMember && (
                <div className="relative">
                  <input
                    type="text"
                    value={ideaQuery}
                    onChange={(e) => handleIdeaQueryChange(e.target.value)}
                    placeholder="Search Ideas to add…"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {ideaSearchLoading && (
                    <p className="text-xs text-gray-400 mt-1">Searching…</p>
                  )}
                  {ideaResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {ideaResults.map((idea) => (
                        <li key={idea.id}>
                          <button
                            onClick={() => handleAddIdeaRef(idea.id)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-blue-50"
                          >
                            {idea.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Related Challenges */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Related Challenges</h3>
              {report.challenge_refs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No related Challenges added yet.</p>
              ) : (
                <ul className="space-y-1">
                  {report.challenge_refs.map((ref) => (
                    <li key={ref.id} className="flex items-center justify-between text-sm">
                      <button
                        onClick={() => navigate(`/challenges/${ref.challenge_id}`)}
                        className="text-blue-600 hover:underline text-left"
                      >
                        {ref.idea_title}{' '}
                        <span className="text-gray-400 font-normal">
                          — {ref.innovation_day_name}
                        </span>
                      </button>
                      {isMember && (
                        <button
                          onClick={() => handleRemoveChallengeRef(ref.challenge_id)}
                          className="ml-4 text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isMember && (
                <div className="relative">
                  <input
                    type="text"
                    value={challengeQuery}
                    onChange={(e) => handleChallengeQueryChange(e.target.value)}
                    placeholder="Search Challenges to add…"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {challengeSearchLoading && (
                    <p className="text-xs text-gray-400 mt-1">Searching…</p>
                  )}
                  {challengeResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {challengeResults.map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => handleAddChallengeRef(c.id)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-blue-50"
                          >
                            {c.idea_title}{' '}
                            <span className="text-gray-400">— {c.innovation_day_name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

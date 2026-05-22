import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface IdeaView {
  id: number
  title: string
  description: string
  category_id: number
  category_name: string
  author: string
  is_own_idea: boolean
  anonymous: boolean
  image_url: string | null
  archived: boolean
  has_featured_challenge: boolean
  created_at: string
  updated_at: string
  avg_business_impact: number | null
  impact_rater_count: number
  comment_count: number
}

interface CommentView {
  id: number
  employee_id: number
  author: string
  body: string
  created_at: string
  replies: CommentView[]
}

interface IdeaRatingState {
  avg_business_impact: number | null
  impact_rater_count: number
  effort_distribution: { low: number; medium: number; high: number }
  my_rating: {
    business_impact: number | null
    effort_required: 'low' | 'medium' | 'high' | null
  }
}

type ChallengeType =
  | 'implementation_of_improvements'
  | 'experimentation_and_exploration'
  | 'problem_solving_and_brainstorming'

interface ChallengeHistoryItem {
  id: number
  innovation_day_id: number
  innovation_day_name: string
  innovation_day_date: string
  innovation_day_status: string
  challenge_type: ChallengeType
  framing: string | null
  featured: boolean
  created_at: string
}

interface InnovationDayOption {
  id: number
  name: string
  date: string
  status: string
}

const CHALLENGE_TYPE_OPTIONS: { value: ChallengeType; label: string }[] = [
  { value: 'implementation_of_improvements', label: 'Implementation of Improvements' },
  { value: 'experimentation_and_exploration', label: 'Experimentation and Exploration' },
  { value: 'problem_solving_and_brainstorming', label: 'Problem-Solving and Brainstorming' },
]

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const [idea, setIdea] = useState<IdeaView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [removingAnon, setRemovingAnon] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const [rating, setRating] = useState<IdeaRatingState | null>(null)
  const [ratingError, setRatingError] = useState<string | null>(null)

  const [comments, setComments] = useState<CommentView[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newCommentBody, setNewCommentBody] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [postingReply, setPostingReply] = useState(false)

  // Challenge history
  const [challengeHistory, setChallengeHistory] = useState<ChallengeHistoryItem[]>([])
  const [challengeHistoryLoading, setChallengeHistoryLoading] = useState(false)

  // Promote to Innovation Day form
  const [showPromoteForm, setShowPromoteForm] = useState(false)
  const [openDays, setOpenDays] = useState<InnovationDayOption[]>([])
  const [selectedDayId, setSelectedDayId] = useState<number | ''>('')
  const [selectedType, setSelectedType] = useState<ChallengeType>('implementation_of_improvements')
  const [framing, setFraming] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)

  const toggleArchive = async () => {
    if (!idea) return
    setArchiving(true)
    const action = idea.archived ? 'unarchive' : 'archive'
    try {
      const res = await fetch(`${API_BASE}/ideas/${idea.id}/${action}`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Failed to ${action} idea`)
      }
      const data = await res.json()
      setIdea(data.idea)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} idea`)
    } finally {
      setArchiving(false)
    }
  }

  useEffect(() => {
    fetch(`${API_BASE}/ideas/${id}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Idea not found' : 'Failed to load idea')
        return res.json()
      })
      .then((data) => setIdea(data.idea))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load idea'),
      )
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`${API_BASE}/ideas/${id}/ratings`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        return res.json()
      })
      .then((data) => { if (data) setRating(data as IdeaRatingState) })
      .catch(() => { /* non-blocking */ })
  }, [id])

  const fetchComments = () => {
    if (!id) return
    setCommentsLoading(true)
    fetch(`${API_BASE}/ideas/${id}/comments`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        return res.json()
      })
      .then((data) => { if (data) setComments(data.comments as CommentView[]) })
      .catch(() => { /* non-blocking */ })
      .finally(() => setCommentsLoading(false))
  }

  useEffect(() => {
    fetchComments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Load Challenge history for this Idea
  useEffect(() => {
    if (!id) return
    setChallengeHistoryLoading(true)
    fetch(`${API_BASE}/ideas/${id}/challenges`, { credentials: 'include' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setChallengeHistory(data.challenges as ChallengeHistoryItem[]) })
      .catch(() => { /* non-blocking */ })
      .finally(() => setChallengeHistoryLoading(false))
  }, [id])

  // Load open Innovation Days when the promote form is opened
  const openPromoteForm = async () => {
    setPromoteError(null)
    setFraming('')
    setSelectedType('implementation_of_improvements')
    setSelectedDayId('')
    try {
      const res = await fetch(`${API_BASE}/innovation-days`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const days = (data.innovation_days as InnovationDayOption[]).filter(
          (d) => d.status === 'open',
        )
        setOpenDays(days)
        if (days.length > 0) setSelectedDayId(days[0].id)
      }
    } catch { /* non-blocking */ }
    setShowPromoteForm(true)
  }

  const submitPromotion = async () => {
    if (!idea || !selectedDayId) return
    setPromoting(true)
    setPromoteError(null)
    try {
      const res = await fetch(`${API_BASE}/ideas/${idea.id}/challenges`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          innovation_day_id: selectedDayId,
          challenge_type: selectedType,
          framing: framing.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to promote Idea')
      }
      const data = await res.json()
      const newChallenge: ChallengeHistoryItem = {
        id: data.challenge.id,
        innovation_day_id: data.challenge.innovation_day_id,
        innovation_day_name: data.challenge.innovation_day_name,
        innovation_day_date: data.challenge.innovation_day_date,
        innovation_day_status: data.challenge.innovation_day_status,
        challenge_type: data.challenge.challenge_type,
        framing: data.challenge.framing,
        featured: data.challenge.featured,
        created_at: data.challenge.created_at,
      }
      setChallengeHistory((prev) => [newChallenge, ...prev])
      setShowPromoteForm(false)
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to promote Idea')
    } finally {
      setPromoting(false)
    }
  }

  const postComment = async () => {
    if (!newCommentBody.trim()) return
    setPostingComment(true)
    setCommentError(null)
    try {
      const res = await fetch(`${API_BASE}/ideas/${id}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newCommentBody }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to post comment')
      }
      setNewCommentBody('')
      fetchComments()
      setIdea((prev) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev)
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setPostingComment(false)
    }
  }

  const postReply = async (parentId: number) => {
    if (!replyBody.trim()) return
    setPostingReply(true)
    setCommentError(null)
    try {
      const res = await fetch(`${API_BASE}/ideas/${id}/comments/${parentId}/replies`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to post reply')
      }
      setReplyBody('')
      setReplyingTo(null)
      fetchComments()
      setIdea((prev) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev)
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post reply')
    } finally {
      setPostingReply(false)
    }
  }

  const deleteComment = async (commentId: number) => {
    setCommentError(null)
    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to delete comment')
      }
      fetchComments()
      // Re-fetch the idea to get updated comment_count
      fetch(`${API_BASE}/ideas/${id}`, { credentials: 'include' })
        .then(async (res) => res.ok ? res.json() : null)
        .then((data) => { if (data) setIdea(data.idea) })
        .catch(() => { /* non-blocking */ })
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }

  const rateImpact = async (value: number) => {
    setRatingError(null)
    try {
      const res = await fetch(`${API_BASE}/ideas/${id}/ratings/impact`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to rate')
      }
      const data = await res.json()
      setRating(data as IdeaRatingState)
      setIdea((prev) =>
        prev
          ? { ...prev, avg_business_impact: data.avg_business_impact, impact_rater_count: data.impact_rater_count }
          : prev,
      )
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : 'Failed to rate')
    }
  }

  const rateEffort = async (value: 'low' | 'medium' | 'high') => {
    setRatingError(null)
    try {
      const res = await fetch(`${API_BASE}/ideas/${id}/ratings/effort`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to rate')
      }
      const data = await res.json()
      setRating(data as IdeaRatingState)
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : 'Failed to rate')
    }
  }

  const startEdit = () => {
    if (!idea) return
    setEditTitle(idea.title)
    setEditDescription(idea.description)
    setSaveError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setSaveError(null)
  }

  const saveEdit = async () => {
    if (!idea) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`${API_BASE}/ideas/${idea.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to save')
      }
      const data = await res.json()
      setIdea(data.idea)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const removeAnonymous = async () => {
    if (!idea) return
    setRemovingAnon(true)
    try {
      const res = await fetch(`${API_BASE}/ideas/${idea.id}/anonymous`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to remove anonymous status')
      }
      const data = await res.json()
      setIdea(data.idea)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove anonymous status')
    } finally {
      setRemovingAnon(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error || !idea) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p role="alert" className="text-destructive">
            {error ?? 'Idea not found'}
          </p>
          <button
            onClick={() => navigate('/ideas')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Ideas
          </button>
        </div>
      </div>
    )
  }

  const isAdmin = employee?.role === 'admin'
  const canEdit = idea.is_own_idea
  const canRemoveAnonymous = idea.anonymous && (idea.is_own_idea || isAdmin)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <button
          onClick={() => navigate('/ideas')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Ideas
        </button>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          {/* Archived indicator */}
          {idea.archived && (
            <div className="rounded-md bg-amber-100 border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800">
              Archived
            </div>
          )}

          {/* Title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-2xl font-bold bg-transparent border-b border-input focus:outline-none focus:border-ring pb-1"
                />
              ) : (
                <h1 className="text-2xl font-bold text-foreground">{idea.title}</h1>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {idea.has_featured_challenge && (
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                  Featured
                </span>
              )}
              <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                {idea.category_name}
              </span>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{idea.author}</span>
            <span>·</span>
            <span>{new Date(idea.created_at).toLocaleDateString()}</span>
            {idea.anonymous && (
              <>
                <span>·</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">Anonymous</span>
              </>
            )}
          </div>

          {/* Image */}
          {idea.image_url && (
            <img
              src={`${API_BASE}${idea.image_url}`}
              alt="Idea illustration"
              className="rounded-md max-h-64 w-full object-cover"
            />
          )}

          {/* Description */}
          {editing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          ) : (
            <p className="text-foreground whitespace-pre-wrap">{idea.description}</p>
          )}

          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}

          {/* Ratings */}
          {!editing && (
            <div className="border-t border-border pt-4 space-y-4">
              {/* Business Impact */}
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Business Impact</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (rating?.my_rating.business_impact ?? 0) >= star
                    return (
                      <button
                        key={star}
                        onClick={() => rateImpact(star)}
                        aria-label={`Rate business impact ${star} star${star > 1 ? 's' : ''}`}
                        className={`text-xl leading-none transition-colors ${active ? 'text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-300'}`}
                      >
                        ★
                      </button>
                    )
                  })}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {rating && rating.impact_rater_count > 0
                      ? `${rating.avg_business_impact?.toFixed(1)} avg · ${rating.impact_rater_count} ${rating.impact_rater_count === 1 ? 'rater' : 'raters'}`
                      : 'No ratings yet'}
                  </span>
                </div>
              </div>

              {/* Effort Required */}
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Effort Required</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(['low', 'medium', 'high'] as const).map((level) => {
                    const active = rating?.my_rating.effort_required === level
                    const count = rating?.effort_distribution[level] ?? 0
                    return (
                      <button
                        key={level}
                        onClick={() => rateEffort(level)}
                        className={`rounded-md border px-3 py-1 text-sm capitalize transition-colors ${
                          active
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-input hover:bg-muted text-foreground'
                        }`}
                      >
                        {level} {count > 0 && <span className="ml-1 text-xs text-muted-foreground">({count})</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {ratingError && (
                <p role="alert" className="text-sm text-destructive">{ratingError}</p>
              )}
            </div>
          )}

          {/* Actions */}
          {(canEdit || canRemoveAnonymous || isAdmin) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              {canEdit && !editing && (
                <button
                  onClick={startEdit}
                  className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Edit
                </button>
              )}
              {editing && (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                </>
              )}
              {canRemoveAnonymous && (
                <button
                  onClick={removeAnonymous}
                  disabled={removingAnon}
                  className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  {removingAnon ? 'Removing…' : 'Remove Anonymous Status'}
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={toggleArchive}
                  disabled={archiving}
                  className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 ml-auto"
                >
                  {archiving
                    ? idea.archived ? 'Restoring…' : 'Archiving…'
                    : idea.archived ? 'Unarchive' : 'Archive'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Promote to Innovation Day */}
        {!idea.archived && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Promote to Innovation Day</h2>
              {!showPromoteForm && (
                <button
                  onClick={openPromoteForm}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Promote
                </button>
              )}
            </div>

            {showPromoteForm && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Innovation Day
                  </label>
                  {openDays.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open Innovation Days available.</p>
                  ) : (
                    <select
                      value={selectedDayId}
                      onChange={(e) => setSelectedDayId(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {openDays.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.name} ({new Date(day.date).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Challenge Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as ChallengeType)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CHALLENGE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Framing{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    value={framing}
                    onChange={(e) => setFraming(e.target.value)}
                    placeholder="Scope the problem statement for this event…"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                {promoteError && (
                  <p role="alert" className="text-sm text-destructive">{promoteError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={submitPromotion}
                    disabled={promoting || !selectedDayId || openDays.length === 0}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {promoting ? 'Promoting…' : 'Confirm Promotion'}
                  </button>
                  <button
                    onClick={() => setShowPromoteForm(false)}
                    disabled={promoting}
                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Challenge History */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Challenge History
            {challengeHistory.length > 0 && (
              <span className="ml-1 text-muted-foreground font-normal">
                ({challengeHistory.length})
              </span>
            )}
          </h2>

          {challengeHistoryLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

          {!challengeHistoryLoading && challengeHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This Idea has not been promoted to any Innovation Day yet.
            </p>
          )}

          <div className="space-y-3">
            {challengeHistory.map((ch) => (
              <div
                key={ch.id}
                className="rounded-md border border-border p-3 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/challenges/${ch.id}`)}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {ch.featured && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
                      Featured
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground">{ch.innovation_day_name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(ch.innovation_day_date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  ·{' '}
                  {ch.challenge_type === 'implementation_of_improvements'
                    ? 'Implementation of Improvements'
                    : ch.challenge_type === 'experimentation_and_exploration'
                    ? 'Experimentation and Exploration'
                    : 'Problem-Solving and Brainstorming'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Comments section */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Comments {idea.comment_count > 0 && <span className="ml-1 text-muted-foreground font-normal">({idea.comment_count})</span>}
          </h2>

          {/* New top-level comment */}
          <div className="space-y-2">
            <textarea
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <button
              onClick={postComment}
              disabled={postingComment || !newCommentBody.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {postingComment ? 'Posting…' : 'Post comment'}
            </button>
          </div>

          {commentError && (
            <p role="alert" className="text-sm text-destructive">{commentError}</p>
          )}

          {commentsLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}

          {!commentsLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
          )}

          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                {/* Top-level comment */}
                <div className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{comment.body}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => {
                        if (replyingTo === comment.id) {
                          setReplyingTo(null)
                          setReplyBody('')
                        } else {
                          setReplyingTo(comment.id)
                          setReplyBody('')
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reply
                    </button>
                    {(employee?.id === comment.employee_id || employee?.role === 'admin') && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="ml-6 rounded-md border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">{reply.author}</span>
                      <span className="text-xs text-muted-foreground">{new Date(reply.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{reply.body}</p>
                    {(employee?.id === reply.employee_id || employee?.role === 'admin') && (
                      <button
                        onClick={() => deleteComment(reply.id)}
                        className="text-xs text-muted-foreground hover:text-destructive pt-1"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}

                {/* Inline reply box */}
                {replyingTo === comment.id && (
                  <div className="ml-6 space-y-2">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write a reply…"
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => postReply(comment.id)}
                        disabled={postingReply || !replyBody.trim()}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {postingReply ? 'Posting…' : 'Post reply'}
                      </button>
                      <button
                        onClick={() => { setReplyingTo(null); setReplyBody('') }}
                        className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

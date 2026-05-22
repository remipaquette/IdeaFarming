import { useState, useEffect, useRef, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

interface Category {
  id: number
  name: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function IdeaSubmissionPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<string>('')
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API_BASE}/categories`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data = await res.json()
        setCategories(data.categories)
        if (data.categories.length > 0) {
          setCategoryId(String(data.categories[0].id))
        }
      })
      .catch(() => setCategoriesError('Could not load categories.'))
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('category_id', categoryId)
      formData.append('anonymous', String(anonymous))
      if (imageFile) formData.append('image', imageFile)

      const res = await fetch(`${API_BASE}/ideas`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to submit idea')
      }

      const data = await res.json()
      navigate(`/ideas/${(data.idea as { id: number }).id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit idea')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6 p-8 rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Submit an Idea</h1>
          <button
            type="button"
            onClick={() => navigate('/ideas')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Idea title"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your idea"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="category" className="text-sm font-medium text-foreground">
              Category
            </label>
            {categoriesError ? (
              <p role="alert" className="text-sm text-destructive">
                {categoriesError}
              </p>
            ) : (
              <select
                id="category"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {categories.length === 0 ? (
                  <option value="" disabled>
                    No categories available
                  </option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="image" className="text-sm font-medium text-foreground">
              Image{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="image"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-muted/80"
            />
            {imageFile && (
              <p className="text-xs text-muted-foreground">Selected: {imageFile.name}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="anonymous"
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="anonymous" className="text-sm text-foreground">
              Submit anonymously
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Idea'}
          </button>
        </form>
      </div>
    </div>
  )
}


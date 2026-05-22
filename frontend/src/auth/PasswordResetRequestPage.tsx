import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [devToken, setDevToken] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Request failed')
      }
      setSubmitted(true)
      if (data.reset_token) {
        setDevToken(data.reset_token as string)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4 p-8 rounded-lg border border-border bg-card shadow-sm text-center">
          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If this email is registered, a reset link has been generated.
          </p>
          {devToken && (
            <div className="rounded-md bg-muted p-3 text-left">
              <p className="text-xs font-mono text-muted-foreground break-all">
                <span className="font-semibold">Dev token:</span> {devToken}
              </p>
              <Link
                to={`/password-reset/confirm?token=${devToken}`}
                className="mt-2 block text-xs underline text-primary"
              >
                Use this token →
              </Link>
            </div>
          )}
          <Link to="/login" className="block text-sm underline text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-lg border border-border bg-card shadow-sm">
        <h1 className="text-2xl font-bold text-foreground text-center">Reset password</h1>
        <p className="text-sm text-muted-foreground text-center">
          Enter your email address and we will generate a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@company.com"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="underline hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

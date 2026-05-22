import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'

interface Notification {
  id: number
  type: string
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const POLL_INTERVAL_MS = 30_000

const TYPE_LABELS: Record<string, string> = {
  comment_on_idea: 'Someone commented on your Idea',
  reply_on_comment: 'Someone replied to your comment',
  idea_promoted: 'Your Idea was promoted to a Challenge',
  innovation_day_open: 'An Innovation Day is now Open',
  team_full: 'Your Team has reached its size cap',
  report_update_shared: 'A teammate shared a Report update',
}

function notificationLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

export default function NotificationBell() {
  const { employee } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = useCallback(async () => {
    if (!employee) return
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json() as { unread_count: number }
      setUnreadCount(data.unread_count)
    } catch {
      // silently ignore
    }
  }, [employee])

  // Poll for unread count
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Close panel when clicking outside
  useEffect(() => {
    if (!panelOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [panelOpen])

  async function openPanel() {
    setPanelOpen((prev) => !prev)
    if (!panelOpen) {
      setLoadingNotifs(true)
      try {
        const res = await fetch(`${API_BASE}/notifications`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json() as { notifications: Notification[] }
        setNotifications(data.notifications)
      } catch {
        // silently ignore
      } finally {
        setLoadingNotifs(false)
      }
    }
  }

  async function markRead(notificationId: number) {
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        credentials: 'include',
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silently ignore
    }
  }

  async function markAllRead() {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include',
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silently ignore
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loadingNotifs && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            )}
            {!loadingNotifs && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            )}
            {!loadingNotifs &&
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 ${
                    n.read ? 'opacity-60' : 'bg-muted/30'
                  }`}
                >
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  {n.read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{notificationLabel(n.type)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

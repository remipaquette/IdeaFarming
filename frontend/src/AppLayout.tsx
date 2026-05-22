import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import NotificationBell from './notifications/NotificationBell'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { employee, logout } = useAuth()
  const isAdmin = employee?.role === 'admin'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const isPath = (path: string) => location.pathname.startsWith(path)

  return (
    <>
      <header className="border-b border-border bg-card px-4 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/ideas')}
              className="text-xl font-bold text-foreground hover:text-primary"
            >
              IdeaFarming
            </button>
            <nav className="flex items-center gap-4 text-sm">
              <button
                onClick={() => navigate('/ideas')}
                className={
                  isPath('/ideas') || location.pathname === '/'
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }
              >
                Ideas
              </button>
              <button
                onClick={() => navigate('/innovation-days')}
                className={
                  isPath('/innovation-days')
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }
              >
                Innovation Days
              </button>
              <button
                onClick={() => navigate('/my-activity')}
                className={
                  location.pathname === '/my-activity'
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }
              >
                My Activity
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/admin/categories')}
                    className={
                      location.pathname === '/admin/categories'
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }
                  >
                    Categories
                  </button>
                  <button
                    onClick={() => navigate('/admin/innovation-days')}
                    className={
                      location.pathname === '/admin/innovation-days'
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }
                  >
                    Manage Events
                  </button>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {employee?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {children}
    </>
  )
}

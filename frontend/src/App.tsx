import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AppLayout from './AppLayout'
import LoginPage from './auth/LoginPage'
import PasswordResetRequestPage from './auth/PasswordResetRequestPage'
import PasswordResetConfirmPage from './auth/PasswordResetConfirmPage'
import CategoryAdminPage from './categories/CategoryAdminPage'
import IdeaSubmissionPage from './ideas/IdeaSubmissionPage'
import IdeaListPage from './ideas/IdeaListPage'
import IdeaDetailPage from './ideas/IdeaDetailPage'
import ChallengeDetailPage from './ideas/ChallengeDetailPage'
import InnovationDayListPage from './innovation-days/InnovationDayListPage'
import InnovationDayDetailPage from './innovation-days/InnovationDayDetailPage'
import InnovationDayAdminPage from './innovation-days/InnovationDayAdminPage'
import MyActivityPage from './activity/MyActivityPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { employee, isLoading } = useAuth()
  if (isLoading) return null
  if (!employee) return <Navigate to="/login" replace />
  return <AppLayout>{children}</AppLayout>
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { employee, isLoading } = useAuth()
  if (isLoading) return null
  if (employee) return <Navigate to="/ideas" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/password-reset" element={<PasswordResetRequestPage />} />
      <Route path="/password-reset/confirm" element={<PasswordResetConfirmPage />} />
      <Route
        path="/"
        element={<Navigate to="/ideas" replace />}
      />
      <Route
        path="/ideas"
        element={
          <RequireAuth>
            <IdeaListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/ideas/new"
        element={
          <RequireAuth>
            <IdeaSubmissionPage />
          </RequireAuth>
        }
      />
      <Route
        path="/ideas/:id"
        element={
          <RequireAuth>
            <IdeaDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/challenges/:id"
        element={
          <RequireAuth>
            <ChallengeDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <RequireAuth>
            <CategoryAdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/innovation-days"
        element={
          <RequireAuth>
            <InnovationDayListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/innovation-days/:id"
        element={
          <RequireAuth>
            <InnovationDayDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/innovation-days"
        element={
          <RequireAuth>
            <InnovationDayAdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/my-activity"
        element={
          <RequireAuth>
            <MyActivityPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/ideas" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App


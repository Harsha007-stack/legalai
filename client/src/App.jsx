import { Link, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { useDemo } from './context/useDemo'
import { AdvocateDashboard, AdvocateProfileEditor, AdvocateRequests } from './pages/AdvocatePages'
import { AssistantPage, CitizenDashboard, DocumentsPage, LawyersPage, LawyerProfilePage, RequestsPage } from './pages/CitizenPages'
import ConsultationWorkspace from './pages/ConsultationWorkspace'
import { AboutPage, LandingPage, LoginPage, RegisterPage } from './pages/PublicPages'

function ProtectedRoute({ role, children }) {
  const { user, authLoading, authError } = useDemo()
  if (authLoading) return <main className="not-found"><span className="eyebrow">RESTORING SESSION</span><h1>Loading your workspace…</h1></main>
  if (authError) return <main className="not-found"><span className="eyebrow">ACCOUNT SETUP</span><h1>We couldn’t load your profile.</h1><p>{authError}</p><Link className="button button-outline" to="/login">Return to sign in</Link></main>
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'advocate' ? '/advocate' : '/app'} replace />
  return children
}

function Shell({ role, children }) {
  return (
    <ProtectedRoute role={role}>
      <AppLayout role={role}>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/app" element={<Shell role="citizen"><CitizenDashboard /></Shell>} />
      <Route path="/app/assistant" element={<Shell role="citizen"><AssistantPage /></Shell>} />
      <Route path="/app/lawyers" element={<Shell role="citizen"><LawyersPage /></Shell>} />
      <Route path="/app/lawyers/:id" element={<Shell role="citizen"><LawyerProfilePage /></Shell>} />
      <Route path="/app/requests" element={<Shell role="citizen"><RequestsPage /></Shell>} />
      <Route path="/app/requests/:id" element={<Shell role="citizen"><ConsultationWorkspace /></Shell>} />
      <Route path="/app/documents" element={<Shell role="citizen"><DocumentsPage /></Shell>} />
      <Route path="/advocate" element={<Shell role="advocate"><AdvocateDashboard /></Shell>} />
      <Route path="/advocate/requests" element={<Shell role="advocate"><AdvocateRequests /></Shell>} />
      <Route path="/advocate/requests/:id" element={<Shell role="advocate"><ConsultationWorkspace /></Shell>} />
      <Route path="/advocate/profile" element={<Shell role="advocate"><AdvocateProfileEditor /></Shell>} />
      <Route path="*" element={<main className="not-found"><span className="eyebrow">404 · Page not found</span><h1>We can’t find that page.</h1><Link className="button button-primary" to="/">Back to home</Link></main>} />
    </Routes>
  )
}

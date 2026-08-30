import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import { useSession } from './api/useSession'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Levels from './pages/Levels'
import Profile from './pages/Profile'
import AiCoach from './pages/AiCoach'
import Tools from './pages/Tools'
import AiToolPage from './pages/AiToolPage'
import SalesAutomation from './pages/SalesAutomation'
import Leads from './pages/Leads'
import Inbox from './pages/Inbox'

/**
 * Authentication is opt-in: with no password configured the server reports it
 * disabled and this gate never renders, which is why the whole app still runs
 * on an empty environment.
 */
function Gate() {
  const session = useSession()

  if (session.loading) return null
  if (session.enabled && !session.authenticated) return <Login login={session.login} />

  return (
    <HashRouter>
      <Routes>
        {/* The five tabs. */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/levels" element={<Levels />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/ai-coach" element={<AiCoach />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/:toolId" element={<AiToolPage />} />

        {/* The sales-automation tool, reached from the tools grid. */}
        <Route path="/sales-automation" element={<SalesAutomation />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/inbox" element={<Inbox />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <Gate />
    </I18nProvider>
  )
}

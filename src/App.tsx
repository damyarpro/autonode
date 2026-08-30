import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import { SessionProvider, useSessionContext } from './api/SessionProvider'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Levels from './pages/Levels'
import Profile from './pages/Profile'
import AiCoach from './pages/AiCoach'
import Tools from './pages/Tools'
import Business from './pages/Business'
import Content from './pages/Content'
import Calls from './pages/Calls'
import Studio from './pages/Studio'
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
  const session = useSessionContext()

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

        {/* The business profile every AI feature reads. Reached from Profile. */}
        <Route path="/business" element={<Business />} />

        {/* One page per group of board nodes, reached by tapping the node. */}
        <Route path="/content" element={<Content />} />
        <Route path="/calls" element={<Calls />} />
        <Route path="/studio" element={<Studio />} />

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
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </I18nProvider>
  )
}

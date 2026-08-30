import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import Dashboard from './pages/Dashboard'
import Levels from './pages/Levels'
import Profile from './pages/Profile'
import AiCoach from './pages/AiCoach'
import Tools from './pages/Tools'
import SalesAutomation from './pages/SalesAutomation'
import Leads from './pages/Leads'
import Inbox from './pages/Inbox'

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          {/* The five tabs. */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/levels" element={<Levels />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/ai-coach" element={<AiCoach />} />
          <Route path="/tools" element={<Tools />} />

          {/* The sales-automation tool, reached from the tools grid. */}
          <Route path="/sales-automation" element={<SalesAutomation />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/inbox" element={<Inbox />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}

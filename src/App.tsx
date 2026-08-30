import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import SalesAutomation from './pages/SalesAutomation'
import Leads from './pages/Leads'
import Inbox from './pages/Inbox'

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route path="/sales-automation" element={<SalesAutomation />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="*" element={<Navigate to="/sales-automation" replace />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}

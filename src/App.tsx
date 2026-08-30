import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import SalesAutomation from './pages/SalesAutomation'

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route path="/sales-automation" element={<SalesAutomation />} />
          <Route path="*" element={<Navigate to="/sales-automation" replace />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}

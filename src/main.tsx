import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App.tsx'
import { ConfigPage } from './pages/ConfigPage.tsx'
import { CreateMeetingPage } from './pages/CreateMeetingPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { MeetingPage } from './pages/MeetingPage.tsx'
import { SessionProvider } from './session/SessionContext.tsx'
import { ROUTER_MODE } from './lib/router.ts'
import './index.css'

const Router = ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={ROUTER_MODE === 'hash' ? undefined : import.meta.env.BASE_URL}>
      <SessionProvider>
        <Routes>
          <Route path="/config" element={<ConfigPage />} />
          <Route element={<App />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateMeetingPage />} />
            <Route path="/meetings/:meetingId" element={<MeetingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SessionProvider>
    </Router>
  </StrictMode>,
)

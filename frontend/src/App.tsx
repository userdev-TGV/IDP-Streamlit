import { Route, Routes, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import Home from './routes/Home'
import ExtractionPage from './features/extraction/ExtractionPage'
import ResultsPage from './features/extraction/ResultsPage'
import ChatDocPage from './features/chatDoc/ChatDocPage'
import ChatDbPage from './features/chatDb/ChatDbPage'
import ChartsPage from './features/charts/ChartsPage'
import Login from './routes/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Tour from './components/Tour'
import { useEffect } from 'react'
import FooterBar from './components/FooterBar'

function App() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated) return
    if (location.pathname === '/login') return
    localStorage.setItem('idp-last-route', location.pathname)
  }, [location.pathname, isAuthenticated])

  return (
    <div className={`app-shell${isAuthenticated ? ' sidebar-layout' : ''}`}>
      {isAuthenticated && <NavBar />}
      <div className="content-shell">
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/extract" element={<ExtractionPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/chat-doc" element={<ChatDocPage />} />
              <Route path="/chat-db" element={<ChatDbPage />} />
              <Route path="/charts" element={<ChartsPage />} />
            </Route>
          </Routes>
        </main>
        {isAuthenticated && <FooterBar />}
      </div>
      {isAuthenticated && <Tour />}
    </div>
  )
}

export default App

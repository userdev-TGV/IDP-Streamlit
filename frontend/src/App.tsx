import { Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import Home from './routes/Home'
import ExtractionPage from './features/extraction/ExtractionPage'
import ResultsPage from './features/extraction/ResultsPage'
import ChatDocPage from './features/chatDoc/ChatDocPage'
import ChatDbPage from './features/chatDb/ChatDbPage'
import ChartsPage from './features/charts/ChartsPage'

function App() {
  return (
    <div>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/extract" element={<ExtractionPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/chat-doc" element={<ChatDocPage />} />
        <Route path="/chat-db" element={<ChatDbPage />} />
        <Route path="/charts" element={<ChartsPage />} />
      </Routes>
    </div>
  )
}

export default App

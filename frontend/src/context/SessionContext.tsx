import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ProcessedDocument, Metrics } from '../types'
import { warmupDatabases } from '../api/contracts'

interface SessionState {
  extractedText: ProcessedDocument['extracted_text']
  openaiResponse: ProcessedDocument['openai_response'] | null
  metrics: Metrics | null
  setSession: (payload: Partial<Omit<SessionState, 'setSession'>>) => void
  reset: () => void
}

const SessionContext = createContext<SessionState | undefined>(undefined)

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [extractedText, setExtractedText] = useState<ProcessedDocument['extracted_text']>([])
  const [openaiResponse, setOpenaiResponse] = useState<ProcessedDocument['openai_response'] | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  // Despertar las bases de datos cuando se inicia la app
  useEffect(() => {
    warmupDatabases()
  }, [])

  const setSession = (payload: Partial<Omit<SessionState, 'setSession' | 'reset'>>) => {
    if (payload.extractedText !== undefined) setExtractedText(payload.extractedText)
    if (payload.openaiResponse !== undefined) setOpenaiResponse(payload.openaiResponse)
    if (payload.metrics !== undefined) setMetrics(payload.metrics)
  }

  const reset = () => {
    setExtractedText([])
    setOpenaiResponse(null)
    setMetrics(null)
  }

  return (
    <SessionContext.Provider value={{ extractedText, openaiResponse, metrics, setSession, reset }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

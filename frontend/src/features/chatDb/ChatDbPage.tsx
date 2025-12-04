import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { AxiosError } from 'axios'
import { chatWithDatabase, generateChart } from '../../api/contracts'
import { useAuth } from '../../context/AuthContext'

export function ChatDbPage() {
  const { consume } = useAuth()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [chartImage, setChartImage] = useState<string | null>(null)
  const [chartDesc, setChartDesc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [showAnswerHint, setShowAnswerHint] = useState(false)
  const [hintPos, setHintPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const answerRef = useRef<HTMLDivElement | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!question.trim()) throw new Error('Ingresa una pregunta')
      await consume('chat_db', 1)
      return chatWithDatabase(question)
    },
    onSuccess: (data) => {
      setAnswer(data.answer)
      setError(null)
      setChartImage(null)
      setChartDesc(null)
      setChartError(null)
      setShowAnswerHint(true)
    },
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string }>
      setError(ax.response?.data?.detail || ax.message)
      setAnswer('')
    },
  })

  const chartMutation = useMutation({
    mutationFn: async () => {
      if (!answer.trim()) throw new Error('No hay respuesta para graficar')
      await consume('charts', 1)
      return generateChart(
        `Genera un grafico claro y con colores distintos usando los datos de esta respuesta: ${answer}`
      )
    },
    onSuccess: (data) => {
      setChartImage(`data:image/png;base64,${data.image}`)
      setChartDesc(data.description)
      setChartError(null)
    },
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string }>
      setChartError(ax.response?.data?.detail || ax.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  const handleGenerateChart = () => {
    setChartImage(null)
    setChartDesc(null)
    chartMutation.mutate()
  }

  const isWakingDb = mutation.isPending
  const warmupHint =
    mutation.error && (mutation.error as AxiosError<{ detail?: string }>).response?.status === 503
      ? 'Aguarde un momento, estamos cargando los datos'
      : isWakingDb
        ? 'Aguarde un momento, estamos cargando los datos'
        : null

  const renderAnswerHtml = (text: string) => {
    const bolded = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    const lines = bolded
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const listItems = lines.filter((l) => l.startsWith('-'))
    const other = lines.filter((l) => !l.startsWith('-'))
    const parts: string[] = []
    if (other.length) {
      parts.push(other.map((l) => `<p>${l}</p>`).join(''))
    }
    if (listItems.length) {
      const cleaned = listItems.map((l) => l.replace(/^[-*]\s*/, ''))
      parts.push(`<ul>${cleaned.map((c) => `<li>${c}</li>`).join('')}</ul>`)
    }
    return parts.length ? parts.join('') : bolded.replace(/\n/g, '<br/>')
  }

  useEffect(() => {
    if (!showAnswerHint || !answerRef.current) return
    const updatePos = () => {
      const rect = answerRef.current?.getBoundingClientRect()
      if (!rect) return
      setHintPos({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [showAnswerHint])

  return (
    <div className="container" data-tour-target="nav-chat-db">
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <div className="chip">Azure SQL + OpenAI</div>
        <h2>Chat con Base de Datos</h2>
        <p className="muted">
          Escribe tu pregunta en lenguaje natural. El asistente generara la consulta SQL, leera la base de Azure SQL y
          respondara con los datos. (Tabla objetivo: Contracts).
        </p>
        <form className="grid two-col" onSubmit={handleSubmit} data-tour-target="idp-chat-db-form">
          <label className="card">
            <span>Pregunta</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="Ej. Cuantos contratos activos hay por pais?"
            />
          </label>
          <div className="card">
            <span>Tips</span>
            <ul style={{ paddingLeft: '1.1rem', color: '#4b5563', lineHeight: 1.6 }}>
              <li>Usa lenguaje natural.</li>
              <li>La tabla disponible es <strong>Contracts</strong>.</li>
              <li>Se limita a SELECT para seguridad.</li>
            </ul>
            <button className="btn btn-primary" type="submit" disabled={mutation.isPending} style={{ marginTop: '0.5rem' }}>
              {mutation.isPending ? 'Consultando...' : 'Preguntar'}
            </button>
            {warmupHint && <p className="loading-pill">{warmupHint}</p>}
            {error && <p style={{ color: '#ad0f0a' }}>{error}</p>}
          </div>
        </form>
      </div>

      {answer && (
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="answer-header">
            <h3>Respuesta</h3>
            <div className="chip ghost">IA</div>
          </div>
          <div
            ref={answerRef}
            className="answer-box"
            data-tour-target="idp-chat-db-answer"
            dangerouslySetInnerHTML={{ __html: renderAnswerHtml(answer) }}
          />
          <div className="answer-actions">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={chartMutation.isPending}
              onClick={handleGenerateChart}
            >
              {chartMutation.isPending ? 'Generando grafico...' : 'Generar grafico'}
            </button>
            {chartMutation.isPending && !chartError && <span className="loading-pill">Armando grafico...</span>}
            {chartError && <p className="error-text">{chartError}</p>}
          </div>
          {chartImage && (
            <div className="chart-preview">
              <img src={chartImage} alt="Grafico generado" />
              {chartDesc && <p className="muted">{chartDesc}</p>}
            </div>
          )}
        </div>
      )}

      {showAnswerHint && hintPos && (
        <>
          <div
            className="answer-highlight"
            style={{
              top: hintPos.top - 6,
              left: hintPos.left - 6,
              width: hintPos.width + 12,
              height: hintPos.height + 12,
            }}
          />
          <div
            className="answer-flyout"
            style={{
              top: hintPos.top + hintPos.height / 2 - 70,
              left: hintPos.left + hintPos.width + 16,
            }}
          >
            <div className="answer-flyout__arrow" />
            <p className="answer-popover-title">Aqui puedes visualizar la respuesta</p>
            <button className="btn btn-primary" onClick={() => setShowAnswerHint(false)}>
              Ok
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ChatDbPage

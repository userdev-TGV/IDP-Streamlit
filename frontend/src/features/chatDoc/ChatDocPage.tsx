import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { chatWithDocument } from '../../api/contracts'
import { useSession } from '../../context/SessionContext'
import { ChatMessage } from '../../types'
import { useAuth } from '../../context/AuthContext'

export function ChatDocPage() {
  const { extractedText } = useSession()
  const { consume } = useAuth()
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAnswerHint, setShowAnswerHint] = useState(false)
  const [hintPos, setHintPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const answerRef = useRef<HTMLDivElement | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      await consume('chat_doc', 1)
      return chatWithDocument(extractedText, question)
    },
    onSuccess: (data) => {
      setHistory((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: data.answer }])
      setQuestion('')
      setError(null)
      setShowAnswerHint(true)
    },
    onError: (err) => {
      setError((err as Error).message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!question) return
    mutation.mutate()
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
    <div className="container" data-tour-target="nav-chat-doc">
      <div className="card">
        <h2>Chat con Contrato</h2>
        {extractedText.length === 0 && <p>Procesa un documento para habilitar el chat.</p>}
        {extractedText.length > 0 && (
          <>
            <div
              ref={answerRef}
              className="card answer-panel"
              style={{ maxHeight: 320, overflow: 'auto' }}
              data-tour-target="idp-chat-doc-answer"
            >
              {history.map((msg, idx) => (
                <p key={idx}>
                  <strong>{msg.role === 'user' ? 'Usuario' : 'Asistente'}:</strong> {msg.content}
                </p>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="grid" data-tour-target="idp-chat-doc-input">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="Escribe tu pregunta sobre el contrato"
              />
              <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Preguntando...' : 'Enviar'}
              </button>
              {error && <p style={{ color: '#ad0f0a' }}>{error}</p>}
            </form>
          </>
        )}
      </div>

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

export default ChatDocPage

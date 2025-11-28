import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { chatWithDocument } from '../../api/contracts'
import { useSession } from '../../context/SessionContext'
import { ChatMessage } from '../../types'

export function ChatDocPage() {
  const { extractedText } = useSession()
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<ChatMessage[]>([])

  const mutation = useMutation({
    mutationFn: () => chatWithDocument(extractedText, question),
    onSuccess: (data) => {
      setHistory((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: data.answer }])
      setQuestion('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!question) return
    mutation.mutate()
  }

  return (
    <div className="container">
      <div className="card">
        <h2>💬 Chat con Contrato</h2>
        {extractedText.length === 0 && <p>Procesa un documento para habilitar el chat.</p>}
        {extractedText.length > 0 && (
          <>
            <div className="card" style={{ maxHeight: 320, overflow: 'auto' }}>
              {history.map((msg, idx) => (
                <p key={idx}>
                  <strong>{msg.role === 'user' ? 'Usuario' : 'Asistente'}:</strong> {msg.content}
                </p>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="grid">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="Escribe tu pregunta sobre el contrato"
              />
              <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Preguntando...' : 'Enviar'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ChatDocPage

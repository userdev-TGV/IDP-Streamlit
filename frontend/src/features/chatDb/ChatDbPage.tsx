import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { chatWithDatabase } from '../../api/contracts'

export function ChatDbPage() {
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState('')
  const [preview, setPreview] = useState<any[]>([])
  const [answer, setAnswer] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Carga un CSV o Excel')
      return chatWithDatabase(file, question)
    },
    onSuccess: (data) => {
      setAnswer(data.answer)
      setPreview(data.preview)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="container">
      <div className="card">
        <h2>🗄️ Chat con Base de Datos</h2>
        <form className="grid two-col" onSubmit={handleSubmit}>
          <label className="card">
            <span>Archivo CSV/XLSX</span>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="card">
            <span>Pregunta</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="Ej. ¿Cuál es el total de contratos activos?"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Consultando...' : 'Preguntar'}
          </button>
        </form>
        {answer && (
          <div className="card">
            <h3>Respuesta</h3>
            <p>{answer}</p>
          </div>
        )}
        {preview.length > 0 && (
          <div className="card">
            <h3>Vista previa de datos</h3>
            <pre>{JSON.stringify(preview, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatDbPage

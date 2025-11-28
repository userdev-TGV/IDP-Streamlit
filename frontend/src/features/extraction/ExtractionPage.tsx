import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { processDocument } from '../../api/contracts'
import { useSession } from '../../context/SessionContext'

const languages = ['English', 'Spanish', 'Russian', 'Portuguese']

export function ExtractionPage() {
  const { setSession, reset } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState('English')
  const [customPrompt, setCustomPrompt] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Selecciona un archivo')
      return processDocument(file, { language, customPrompt: customPrompt || undefined })
    },
    onSuccess: (data) => {
      setSession({
        extractedText: data.extracted_text,
        openaiResponse: data.openai_response,
        metrics: data.metrics,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    reset()
    mutation.mutate()
  }

  return (
    <div className="container">
      <div className="card">
        <h2>📑 Extracción Estándar</h2>
        <form className="grid two-col" onSubmit={handleSubmit}>
          <label className="card">
            <span>Archivo PDF o Imagen</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <div className="card">
            <label>
              Idioma
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((lng) => (
                  <option key={lng} value={lng}>
                    {lng}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prompt personalizado (opcional)
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                placeholder="Sobrescribe el prompt por defecto"
              />
            </label>
          </div>
          <div>
            <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Procesando...' : 'Procesar documento'}
            </button>
            {mutation.error && <p style={{ color: 'red' }}>{(mutation.error as Error).message}</p>}
            {mutation.isSuccess && <p>Documento procesado correctamente.</p>}
          </div>
        </form>
      </div>
    </div>
  )
}

export default ExtractionPage

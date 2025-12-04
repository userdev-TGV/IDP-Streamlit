import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { downloadCsv, downloadJson, processDocument } from '../../api/contracts'
import { useSession } from '../../context/SessionContext'
import { useAuth } from '../../context/AuthContext'

export function ExtractionPage() {
  const { setSession, reset } = useSession()
  const { consume } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecciona un archivo')
      await consume('extract', 1)
      return processDocument(file, { language: undefined, customPrompt: customPrompt || undefined })
    },
    onSuccess: (data) => {
      setSession({
        extractedText: data.extracted_text,
        openaiResponse: data.openai_response,
        metrics: data.metrics,
      })
      setError(null)
    },
    onError: (err) => {
      setError((err as Error).message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    reset()
    mutation.mutate()
  }

  return (
    <div className="container fluid">
      <div className="card">
        <div className="chip">OCR + OpenAI</div>
        <h2>Extracci?n Est?ndar</h2>
        <p className="muted">
          Sube tu contrato y (opcional) sobrescribe el prompt. OpenAI detecta el idioma autom?ticamente. El resultado se
          mostrar? abajo en JSON y podr?s reutilizarlo en las otras secciones.
        </p>
        <form className="grid two-col" onSubmit={handleSubmit}>
          <label className="card">
            <span>Archivo PDF o Imagen</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && <p className="muted">Seleccionado: {file.name}</p>}
          </label>
          <div className="card">
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
            {error && <p style={{ color: '#ad0f0a' }}>{error}</p>}
            {mutation.isSuccess && <p className="muted">Documento procesado correctamente.</p>}
          </div>
        </form>
      </div>

      <ExtractionResultsPanel />
    </div>
  )
}

export default ExtractionPage

function ExtractionResultsPanel() {
  const { openaiResponse } = useSession()
  if (!openaiResponse) return null

  const handleDownloadJson = async () => {
    const blob = await downloadJson(openaiResponse)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'results.json'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleDownloadCsv = async () => {
    const results = Array.isArray(openaiResponse.contracts) ? openaiResponse.contracts : [openaiResponse]
    const blob = await downloadCsv(results)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'results.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const contracts = Array.isArray(openaiResponse.contracts) ? openaiResponse.contracts : []

  return (
    <div className="cards-grid" style={{ marginTop: '1.5rem' }}>
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <div className="chip">Resultados</div>
        <h3>Resumen del contrato</h3>
        <p className="muted">Vista amigable del JSON extra?do. Copia, descarga o usa el contexto para chatear directamente.</p>

        {contracts.length ? (
          <div className="cards-grid">
            {contracts.map((contract: any, idx: number) => {
              const payments = Array.isArray(contract['Payment Values']) ? contract['Payment Values'] : []
              return (
                <div className="card" key={idx}>
                  <div className="chip">Contrato #{idx + 1}</div>
                  <h4>{contract['Contract'] || 'Contrato sin nombre'}</h4>
                  <p className="muted">{contract['Customer']}</p>
                  <ul style={{ paddingLeft: '1.1rem', color: '#4b5563', lineHeight: 1.6 }}>
                    <li>
                      <strong>Tipo:</strong> {contract['Contract Type'] || 'N/D'}
                    </li>
                    <li>
                      <strong>Regi?n:</strong> {contract['Region'] || 'N/D'}
                    </li>
                    <li>
                      <strong>Vigencia:</strong> {contract['Effective Date'] || 'N/D'} ? {contract['Expiration Date'] || 'N/D'}
                    </li>
                    <li>
                      <strong>Pago:</strong> {contract['Payment Type'] || 'N/D'} ({contract['Payment Value'] || 'N/D'})
                    </li>
                    <li>
                      <strong>Moneda:</strong> {contract['Currency'] || 'N/D'}
                    </li>
                  </ul>

                  {payments.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong>Payment Values:</strong>
                      <ul style={{ paddingLeft: '1.1rem', color: '#4b5563', lineHeight: 1.6 }}>
                        {payments.map((p: any, i: number) => {
                          const label = p?.name || `Payment #${i + 1}`
                          const value = p?.value ?? p
                          return (
                            <li key={i}>
                              <strong>{label}:</strong> {value}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {contract['Promo Tactic'] && (
                    <>
                      <strong>T?cticas:</strong>
                      <ul style={{ paddingLeft: '1.1rem', color: '#4b5563' }}>
                        {contract['Promo Tactic']?.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {contract['Incentives Details'] && (
                    <>
                      <strong>Incentivos:</strong>
                      <ul style={{ paddingLeft: '1.1rem', color: '#4b5563' }}>
                        {contract['Incentives Details']?.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted">No se encontraron contratos en la respuesta.</p>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleDownloadJson}>
            Descargar JSON
          </button>
          <button className="btn btn-primary" onClick={handleDownloadCsv}>
            Descargar CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ gridColumn: 'span 2' }}>
        <div className="chip">JSON</div>
        <h4>JSON extra?do</h4>
        <pre
          style={{
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: '12px',
            overflowX: 'auto',
            border: '1px solid #e5e7eb',
          }}
        >
          {JSON.stringify(openaiResponse, null, 2)}
        </pre>
      </div>
    </div>
  )
}

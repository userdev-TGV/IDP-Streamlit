import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { downloadCsv, downloadJson, processDocument } from '../../api/contracts'
import { useSession } from '../../context/SessionContext'
import { useAuth } from '../../context/AuthContext'

export function ExtractionPage() {
  const { setSession, reset } = useSession()
  const { consume, tokensRemaining } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const openFilePicker = () => fileInputRef.current?.click()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecciona un archivo')
      if (tokensRemaining <= 0) throw new Error('Sin creditos disponibles')
      const result = await processDocument(file, { language: undefined, customPrompt: customPrompt || undefined })
      const backendTokens = Number(result.metrics?.tokens_to_consume || 0)
      const usageTokens = Math.ceil(Number(result.metrics?.openai_tokens || 0) / 1000)
      const tokensToConsume = Math.max(1, backendTokens || usageTokens || 1)
      await consume('extract', tokensToConsume)
      return result
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
      <div className="card" id="idp-upload" data-tour-target="idp-upload">
        <h2>Extraccion Manual</h2>
        <p className="muted">
          Sube tu contrato y (opcional) sobrescribe el prompt. La inteligencia artificial detectará el idioma automáticamente. El resultado se
          mostrará abajo en JSON y podrás reutilizarlo en las otras secciones.
        </p>
        <form className="grid two-col" onSubmit={handleSubmit}>
          <div className="card upload-card">
            <div className="upload-head">
              <div>
                <p className="eyebrow">Carga de archivo</p>
                <h4>PDF, PNG o JPG</h4>
              </div>
            </div>

            <div
              className="upload-zone"
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openFilePicker()
                }
              }}
            >
              <div className="upload-zone-icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" role="presentation">
                  <path
                    d="M20 40c-2.21 0-4 1.79-4 4v6c0 2.21 1.79 4 4 4h24c2.21 0 4-1.79 4-4v-6c0-2.21-1.79-4-4-4"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M32 44V16"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 26l10-10 10 10"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="upload-zone-text">
                <strong>Arrastra y suelta el archivo</strong>
                <span className="muted">o haz clic para buscarlo</span>
              </div>
            </div>

            <div className="upload-status">
              <div className="upload-file-pill">
                {file ? (
                  <>
                    <strong>Seleccionado:</strong> {file.name}
                  </>
                ) : (
                  'Ningun archivo seleccionado'
                )}
              </div>
              <button type="button" className="btn btn-ghost" onClick={openFilePicker}>
                Elegir archivo
              </button>
            </div>
            <input
              ref={fileInputRef}
              id="idp-file-input"
              type="file"
              className="upload-input"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
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
    <div className="cards-grid" style={{ marginTop: '1.5rem' }} id="idp-results-main" data-tour-target="idp-results-main">
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <div className="chip">Resultados</div>
        <h3>Resumen del contrato</h3>
        <p className="muted">Vista amigable del JSON extraído. Copia, descarga o usa el contexto para chatear directamente.</p>

        {contracts.length ? (
          <div className="cards-grid">
            {contracts.map((contract: any, idx: number) => {
              const payments = Array.isArray(contract['Payment Values']) ? contract['Payment Values'] : []
              return (
                <div className="card" key={idx}>
                  <div className="chip">Valor de pago #{idx + 1}</div>
                  <h4>{contract['Contract'] || 'Contrato sin nombre'}</h4>
                  <p className="muted">{contract['Customer']}</p>
                  <ul style={{ paddingLeft: '1.1rem', color: '#4b5563', lineHeight: 1.6 }}>
                    <li>
                      <strong>Tipo:</strong> {contract['Contract Type'] || 'N/D'}
                    </li>
                    <li>
                      <strong>Región:</strong> {contract['Region'] || 'N/D'}
                    </li>
                    <li>
                      <strong>Vigencia:</strong> {contract['Effective Date'] || 'N/D'} — {contract['Expiration Date'] || 'N/D'}
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
                      <strong>Valores de pago:</strong>
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
                      <strong>Tácticas:</strong>
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
        <h4>JSON extraído</h4>
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

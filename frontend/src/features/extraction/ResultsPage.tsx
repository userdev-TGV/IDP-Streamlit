import { downloadCsv, downloadJson } from '../../api/contracts'
import { useSession } from '../../context/SessionContext'

export function ResultsPage() {
  const { openaiResponse, metrics, extractedText } = useSession()

  const handleDownloadJson = async () => {
    if (!openaiResponse) return
    const blob = await downloadJson(openaiResponse)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'results.json'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleDownloadCsv = async () => {
    if (!openaiResponse) return
    const results = Array.isArray(openaiResponse.contracts) ? openaiResponse.contracts : [openaiResponse]
    const blob = await downloadCsv(results)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'results.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <div className="card">
        <h2>📄 Resultados</h2>
        {!openaiResponse && <p>Aún no hay resultados. Procesa un documento primero.</p>}
        {openaiResponse && (
          <div className="grid two-col">
            <div className="card">
              <h3>Métricas</h3>
              {metrics && (
                <ul>
                  <li>Duración OCR: {metrics.textract_duration.toFixed(2)}s</li>
                  <li>Duración OpenAI: {metrics.openai_duration.toFixed(2)}s</li>
                  <li>Líneas procesadas: {metrics.total_text_lines}</li>
                  <li>Páginas: {metrics.page_count}</li>
                </ul>
              )}
            </div>
            <div className="card">
              <h3>Descargas</h3>
              <button className="btn btn-secondary" onClick={handleDownloadJson}>
                Descargar JSON
              </button>
              <button className="btn btn-primary" style={{ marginLeft: '0.5rem' }} onClick={handleDownloadCsv}>
                Descargar CSV
              </button>
            </div>
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3>JSON bruto</h3>
              <pre
                style={{
                  maxHeight: 400,
                  overflow: 'auto',
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: '1rem',
                }}
              >
                {JSON.stringify(openaiResponse, null, 2)}
              </pre>
            </div>
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3>Texto extraído (para chat)</h3>
              <pre
                style={{
                  maxHeight: 200,
                  overflow: 'auto',
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: '1rem',
                }}
              >
                {JSON.stringify(extractedText, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResultsPage

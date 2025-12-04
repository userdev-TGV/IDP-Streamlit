import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { AxiosError } from 'axios'
import { generateChart } from '../../api/contracts'
import { useAuth } from '../../context/AuthContext'

export function ChartsPage() {
  const { consume } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      await consume('charts', 1)
      return generateChart(prompt)
    },
    onSuccess: (data) => {
      setImage(`data:image/png;base64,${data.image}`)
      setDescription(data.description)
      setError(null)
      try {
        window.dispatchEvent(new CustomEvent('idp-start-tour', { detail: 'charts-result' }))
      } catch {
        // ignore
      }
    },
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string }>
      setError(ax.response?.data?.detail || ax.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  const isWakingDb = mutation.isPending
  const warmupHint =
    mutation.error && (mutation.error as AxiosError<{ detail?: string }>).response?.status === 503
      ? 'Aguarde un momento, estamos cargando los datos'
      : isWakingDb
        ? 'Aguarde un momento, estamos cargando los datos'
        : null

  return (
    <div className="container" data-tour-target="nav-charts">
      <div className="card" data-tour-target="idp-charts-form">
        <h2>Generar graficas</h2>
        <form onSubmit={handleSubmit} className="grid">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Describe la grafica o pega datos tabulares"
          />
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Generando...' : 'Crear grafica'}
          </button>
          {warmupHint && <p className="loading-pill">{warmupHint}</p>}
          {error && <p style={{ color: '#ad0f0a' }}>{error}</p>}
        </form>
        {image && (
          <div className="card" data-tour-target="idp-charts-result">
            <img src={image} alt="Grafica generada" style={{ maxWidth: '100%' }} />
            <p>{description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChartsPage

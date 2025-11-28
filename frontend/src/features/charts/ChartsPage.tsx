import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { generateChart } from '../../api/contracts'

export function ChartsPage() {
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () => generateChart(prompt),
    onSuccess: (data) => {
      setImage(`data:image/png;base64,${data.image}`)
      setDescription(data.description)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="container">
      <div className="card">
        <h2>📊 Generar gráficas</h2>
        <form onSubmit={handleSubmit} className="grid">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Describe la gráfica o pega datos tabulares"
          />
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Generando...' : 'Crear gráfica'}
          </button>
        </form>
        {image && (
          <div className="card">
            <img src={image} alt="Gráfica generada" style={{ maxWidth: '100%' }} />
            <p>{description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChartsPage

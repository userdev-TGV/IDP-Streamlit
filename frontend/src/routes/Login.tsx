import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [accessId, setAccessId] = useState('Usuario_IDP')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasLoggedBefore, setHasLoggedBefore] = useState(false)

  useEffect(() => {
    setHasLoggedBefore(localStorage.getItem('idp-has-logged') === '1')
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ accessId })
      const lastRoute = localStorage.getItem('idp-last-route')
      localStorage.setItem('idp-has-logged', '1')
      const fallback = (location.state as { from?: string } | null)?.from || '/'
      const target = hasLoggedBefore && lastRoute && lastRoute !== '/login' ? lastRoute : fallback || '/'
      navigate(target, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Acceso seguro</div>
        <h1>Ingresar a IDP</h1>
        <p className="muted">Selecciona tu usuario para ingresar.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Usuario
            <select value={accessId} onChange={(e) => setAccessId(e.target.value)} required>
              <option value="Usuario_IDP">Usuario_IDP</option>
            </select>
          </label>
          {loading && <div className="loading-pill">Aguarde un momento, estamos cargando los datos</div>}
          {error && <div className="error-chip">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Validando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

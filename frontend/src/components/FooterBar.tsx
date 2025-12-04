import { useState } from 'react'
import logo from '../assets/icon.png'
import { requestSpecialist } from '../api/contracts'

export default function FooterBar() {
  const [showModal, setShowModal] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [project, setProject] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setError(null)
    if (!fullName.trim() || !email.trim()) {
      setError('Completa nombre y correo.')
      return
    }
    setSending(true)
    try {
      await requestSpecialist({ name: fullName, email, company, project })
      setStatus('Solicitud enviada. Te contactaremos en menos de 24h.')
      setFullName('')
      setEmail('')
      setCompany('')
      setProject('')
      setTimeout(() => {
        setShowModal(false)
        setStatus(null)
      }, 1800)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <footer className="footer-bar">
        <div className="footer-spacer" />
        <div className="footer-brand">
          <img src={logo} alt="TGV" className="footer-logo" />
          <div>
            <div className="brand-title"></div>
            <div className="brand-sub"></div>
          </div>
        </div>
        <div className="footer-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Agendar especialista
          </button>
        </div>
      </footer>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <div className="modal-header">
              <h3>Agenda con un especialista</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Cuentanos sobre tu proyecto y te contactamos en menos de 24h.
            </p>
            <form className="modal-form" onSubmit={handleSubmit}>
              <label>
                Nombre completo
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" placeholder="Ej. Ana Gomez" required />
              </label>
              <label>
                Correo
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Ej. ana@empresa.com" required />
              </label>
              <label>
                Empresa
                <input value={company} onChange={(e) => setCompany(e.target.value)} type="text" placeholder="Ej. Empresa SA" />
              </label>
              <label>
                Proyecto
                <textarea value={project} onChange={(e) => setProject(e.target.value)} rows={3} placeholder="Detalla alcance, plazos y objetivos." />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
              {status && <p className="muted" style={{ margin: 0 }}>{status}</p>}
              {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  )
}

import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { requestTokens } from '../api/contracts'
import './NavBar.css'

const links = [
  { to: '/', label: 'Inicio', id: 'nav-desc' },
  { to: '/extract', label: 'Extraccion', id: 'nav-extract' },
  { to: '/chat-doc', label: 'Chat Contrato', id: 'nav-chat-doc' },
  { to: '/chat-db', label: 'Chat Base', id: 'nav-chat-db' },
  { to: '/charts', label: 'Graficas', id: 'nav-charts' },
]

export function NavBar() {
  const { user, logout, tokensRemaining } = useAuth()
  const navigate = useNavigate()
  const [showRequest, setShowRequest] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [reqStatus, setReqStatus] = useState<string | null>(null)
  const [reqError, setReqError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleRequestTokens = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqStatus(null)
    setReqError(null)
    setSending(true)
    try {
      await requestTokens(fullName, email)
      setReqStatus('Solicitud enviada. Revisaremos tu pedido.')
      setFullName('')
      setEmail('')
    } catch (err) {
      setReqError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <nav className="navbar" id="idp-header-actions" data-tour-target="idp-header-actions">
      <div className="brand">
        <span className="pill">IDP</span>
        <div>
          <div className="brand-title"></div>
          <div className="brand-sub"></div>
        </div>
      </div>
      <div className="nav-links" data-tour-target="nav-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            id={link.id}
            data-tour-target={link.id}
            to={link.to}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="user-chip" data-tour-target="nav-tokens">
        <div className="avatar">{user?.name?.slice(0, 1) || 'U'}</div>
        <div>
          <div className="user-name">{user?.name || 'Usuario'}</div>
          <div className="user-email">Tokens: {tokensRemaining ?? 0}</div>
        </div>
        <button
          className="ghost"
          onClick={() => {
            try {
              localStorage.removeItem('idp-tour-seen')
              window.dispatchEvent(new CustomEvent('idp-start-tour'))
            } catch {
              /* ignore */
            }
          }}
          data-tour-target="idp-tour-button"
        >
          Tour guiado
        </button>
        {tokensRemaining !== undefined && tokensRemaining <= 0 && (
          <button
            className="ghost"
            onClick={() => {
              document.querySelectorAll('.tour-highlight').forEach((n) => n.classList.remove('tour-highlight'))
              setShowRequest(true)
            }}
          >
            Solicitar tokens
          </button>
        )}
        <button className="ghost" onClick={handleLogout}>
          Cerrar sesion
        </button>
      </div>

      {showRequest && (
        <div className="token-modal">
          <div className="token-modal__content">
            <div className="token-modal__header">
              <h4>Solicitar tokens</h4>
              <button className="ghost" onClick={() => setShowRequest(false)}>
                x
              </button>
            </div>
            <form className="token-form" onSubmit={handleRequestTokens}>
              <label>
                Nombre y apellido
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </label>
              <label>
                Correo
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button className="btn btn-primary" type="submit" disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
              {reqStatus && <p className="muted" style={{ margin: 0 }}>{reqStatus}</p>}
              {reqError && <p className="error-text" style={{ margin: 0 }}>{reqError}</p>}
            </form>
          </div>
        </div>
      )}
    </nav>
  )
}

export default NavBar

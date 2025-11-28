import { NavLink } from 'react-router-dom'
import './NavBar.css'

const links = [
  { to: '/', label: '🏠 Descripción' },
  { to: '/extract', label: '📑 Extracción' },
  { to: '/results', label: '📄 Resultados' },
  { to: '/chat-doc', label: '💬 Chat Contrato' },
  { to: '/chat-db', label: '🗄️ Chat Base' },
  { to: '/charts', label: '📊 Gráficas' },
]

export function NavBar() {
  return (
    <nav className="navbar">
      <div className="brand">IDP</div>
      <div className="nav-links">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default NavBar

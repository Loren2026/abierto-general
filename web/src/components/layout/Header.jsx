import { Link, useLocation } from 'react-router-dom'

export default function Header({ privateArea = false, title = 'Inteligencia Loren', onLogout }) {
  const location = useLocation()

  return (
    <header className={`site-header ${privateArea ? 'site-header--private' : 'site-header--public'}`}>
      <div className="site-header__inner">
        {privateArea ? null : (
          <div className="site-branding">
            <span className="site-branding__eyebrow">Inteligencia Loren</span>
            <strong className="site-branding__title">{title}</strong>
          </div>
        )}

        <nav className="site-header__actions" aria-label="Navegación principal">
          {privateArea ? (
            <>
              <Link to="/admin" className={`nav-chip nav-chip--blue ${location.pathname === '/admin' ? 'is-active' : ''}`}>
                Panel
              </Link>
              <Link to="/admin/agentes" className={`nav-chip nav-chip--orange ${location.pathname === '/admin/agentes' ? 'is-active' : ''}`}>
                Agentes
              </Link>
              <button type="button" className="nav-chip nav-chip--red" onClick={onLogout}>
                Salir
              </button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

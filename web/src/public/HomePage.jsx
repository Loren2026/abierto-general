import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="public-header">
        <Link to="/login" className="login-link">
          Login
        </Link>
      </header>

      <main className="hero-shell">
        <section className="hero-card">
          <div className="hero-badge">Inteligencia Loren</div>
          <h1 className="hero-title">Lorenzo Santiago Iglesias</h1>
          <p className="hero-subtitle">Recorba</p>
          <p className="hero-copy">En construcción</p>
          <button className="download-button" type="button" disabled>
            Descargar
          </button>
        </section>

        <section className="projects-placeholder">
          <h2>Proyectos públicos</h2>
          <p>Aún no hay proyectos públicos disponibles.</p>
        </section>
      </main>
    </div>
  )
}

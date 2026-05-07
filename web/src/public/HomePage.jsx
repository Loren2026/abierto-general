import PublicLayout from '../components/layout/PublicLayout'

export default function HomePage() {
  return (
    <PublicLayout>
      <main className="home-page">
        <section className="hero-shell">
          <div className="hero-card hero-card--orange">
            <div className="hero-badge">En construcción</div>
            <h1 className="hero-title">Lorenzo Santiago Iglesias</h1>
            <p className="hero-subtitle">Recorba</p>
            <p className="hero-copy">
              Una plataforma en evolución para organizar proyectos, accesos y trabajo coordinado
              desde un único lugar.
            </p>
            <button className="download-button" type="button" disabled>
              Descargar
            </button>
          </div>

          <section className="projects-placeholder placeholder-card placeholder-card--green">
            <div>
              <h2>Proyectos públicos</h2>
              <p>Aún no hay proyectos públicos disponibles.</p>
            </div>
          </section>
        </section>
      </main>
    </PublicLayout>
  )
}

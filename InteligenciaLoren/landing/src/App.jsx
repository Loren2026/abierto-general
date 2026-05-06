const apps = [
  {
    name: 'Fit Loren',
    status: 'Disponible',
    description: 'Aplicación orientada al seguimiento, organización y experiencia del ecosistema Fit Loren.',
  },
  {
    name: 'GestActas',
    status: 'Próximamente',
    description: 'Herramienta para gestión documental y trabajo estructurado con actas y contenido asociado.',
  },
]

function App() {
  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero__content">
          <p className="eyebrow">Plataforma privada</p>
          <h1>Inteligencia Loren</h1>
          <p className="hero__lead">
            Un entorno privado y modular para acceder a aplicaciones y herramientas especializadas,
            con un panel centralizado y una experiencia consistente.
          </p>
          <div className="hero__actions">
            <a className="cta cta--primary" href="https://panel.inteligencialoren.com">
              Entrar al panel
            </a>
            <a className="cta cta--secondary" href="#apps">
              Ver aplicaciones
            </a>
          </div>
        </div>
        <div className="hero__panel">
          <div className="panel-card">
            <div className="panel-card__row"><span>Acceso</span><strong>Privado</strong></div>
            <div className="panel-card__row"><span>Apps activas</span><strong>2</strong></div>
            <div className="panel-card__row"><span>Dominio</span><strong>panel.inteligencialoren.com</strong></div>
          </div>
        </div>
      </header>

      <main>
        <section className="section">
          <div className="section__copy narrow">
            <p className="eyebrow">Qué es</p>
            <h2>Una plataforma privada para herramientas reales</h2>
            <p>
              Inteligencia Loren reúne aplicaciones especializadas bajo una identidad común,
              con acceso centralizado, una estética coherente y una base técnica preparada para crecer.
            </p>
          </div>
        </section>

        <section className="section" id="apps">
          <div className="section__copy">
            <p className="eyebrow">Aplicaciones disponibles</p>
            <h2>Apps actuales del ecosistema</h2>
          </div>
          <div className="apps-grid">
            {apps.map((app) => (
              <article key={app.name} className="app-card">
                <div className="app-card__top">
                  <h3>{app.name}</h3>
                  <span className={`badge ${app.status === 'Disponible' ? 'badge--live' : 'badge--soon'}`}>
                    {app.status}
                  </span>
                </div>
                <p>{app.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section section--cta">
          <div className="cta-block">
            <p className="eyebrow">Acceso privado</p>
            <h2>Accede al entorno privado desde el panel</h2>
            <p>
              El panel centraliza el acceso a las aplicaciones disponibles y la evolución del ecosistema.
            </p>
            <a className="cta cta--primary cta--large" href="https://panel.inteligencialoren.com">
              Ir a panel.inteligencialoren.com
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Inteligencia Loren, entorno privado y modular.</p>
        <a href="https://panel.inteligencialoren.com">Abrir panel</a>
      </footer>
    </div>
  )
}

export default App

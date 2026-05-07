import { Link } from 'react-router-dom'

export default function AgentsPage() {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">Coordinación de agentes</h1>
          <span className="dashboard-subtitle">Turín + Claude · espacio de trabajo de Loren</span>
        </div>
        <div className="admin-nav-actions">
          <Link className="secondary-nav-button" to="/admin">
            Volver al panel
          </Link>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="info-card">
          <h2>En preparación</h2>
          <div className="agents-placeholder-copy">
            <p>
              Aquí vivirá la coordinación entre Turín y Claude, el estado compartido de trabajo
              y las decisiones que necesiten el sí o no de Loren.
            </p>
            <p>
              En esta fase queda preparada la ruta y la base responsive, sin conectar todavía la
              lógica completa de coordinación.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

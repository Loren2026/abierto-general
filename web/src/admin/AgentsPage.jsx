import AdminLayout from '../components/layout/AdminLayout'
import '../pages/Dashboard.css'

export default function AgentsPage() {
  return (
    <AdminLayout title="Coordinación de agentes">
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="info-card">
            <h2>Coordinación Turín + Claude</h2>
            <div className="agents-placeholder-copy">
              <p>
                Este espacio queda preparado para centralizar propuestas, decisiones y trabajo
                coordinado antes de pedir a Loren un sí o un no.
              </p>
              <p>
                En la siguiente fase se conectará con el estado compartido, el historial de
                decisiones y la lógica real de coordinación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

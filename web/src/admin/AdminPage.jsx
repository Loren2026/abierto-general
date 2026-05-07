import useAuthStore from '../store/useAuthStore'
import '../pages/Dashboard.css'
import AdminLayout from '../components/layout/AdminLayout'

function AdminPage() {
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <AdminLayout title="Panel Loren" onLogout={handleLogout}>
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="security-banner">
            <div className="security-icon">🔒</div>
            <div className="security-text">
              <h3>Seguridad activada</h3>
              <p>Hash bcrypt, rate limiting, helmet, sesiones 24h y protección CSRF.</p>
            </div>
          </div>

          <div className="info-card">
            <h2>Información del usuario</h2>
            <div className="user-info">
              <div className="info-item">
                <label>ID:</label>
                <span>{user?.id}</span>
              </div>
              <div className="info-item">
                <label>Email:</label>
                <span>{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">5</div>
              <div className="stat-label">Puntos de seguridad</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">24h</div>
              <div className="stat-label">Expiración de sesión</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">5/15m</div>
              <div className="stat-label">Rate limiting login</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">12</div>
              <div className="stat-label">Salt rounds bcrypt</div>
            </div>
          </div>

          <div className="next-steps-card">
            <h2>Estado actual</h2>
            <ul className="next-steps-list">
              <li>✅ Zona pública unificada en construcción</li>
              <li>✅ Acceso Loren integrado en la misma web</li>
              <li>✅ Panel privado protegido por sesión</li>
              <li>✅ Espacio de agentes preparado para la siguiente fase</li>
            </ul>
            <div className="steps-message">La base visual y funcional de la plataforma ya está unificada.</div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminPage

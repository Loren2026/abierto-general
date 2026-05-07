import React from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import '../pages/Dashboard.css';

function AdminPage() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">InteligenciaLoren</h1>
          <span className="dashboard-subtitle">Panel de Administración</span>
        </div>
        <div className="admin-nav-actions">
          <Link className="secondary-nav-button" to="/admin/agentes">
            Agentes
          </Link>
          <button className="logout-button" onClick={handleLogout}>
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="security-banner">
          <div className="security-icon">🔒</div>
          <div className="security-text">
            <h3>Seguridad Activada</h3>
            <p>Hash bcrypt (12 salt rounds), Rate limiting, Helmet, Sesiones 24h, CSRF</p>
          </div>
        </div>

        <div className="info-card">
          <h2>Información del Usuario</h2>
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
            <div className="stat-label">Puntos de Seguridad</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">24h</div>
            <div className="stat-label">Expiración de Sesión</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">5/15m</div>
            <div className="stat-label">Rate Limiting Login</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">12</div>
            <div className="stat-label">Salt Rounds Bcrypt</div>
          </div>
        </div>

        <div className="next-steps-card">
          <h2>Próximos Pasos</h2>
          <ul className="next-steps-list">
            <li>✅ Punto 1: Hash robusto de contraseña con bcrypt</li>
            <li>✅ Punto 2: Rate limiting en login (5 intentos / 15 minutos)</li>
            <li>✅ Punto 3: Helmet y headers de seguridad</li>
            <li>✅ Punto 4: Sesiones con expiración de 24 horas</li>
            <li>✅ Punto 5: CSRF básico</li>
          </ul>
          <div className="steps-message">
            ¡Los 5 puntos de seguridad están implementados!
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;

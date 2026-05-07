import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import './LoginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, user } = useAuthStore();

  useEffect(() => {
    if (user) {
      navigate('/admin', { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email y contraseña son requeridos');
      return;
    }

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const nextPath = location.state?.from || '/admin'
    navigate(nextPath, { replace: true })
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">InteligenciaLoren</h1>
        <p className="login-subtitle">Panel de Administración</p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="login-footer">
          <p>
            🔒 Seguridad activa: Hash bcrypt, Rate limiting, Helmet, CSRF
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

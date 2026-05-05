# InteligenciaLoren Backend

Backend para el panel de administración de InteligenciaLoren.com.

## Características de Seguridad (5 puntos esenciales)

1. **Hash robusto de contraseña con bcrypt**
   - Salt rounds: 12
   - Funciones: `hashPassword()` y `verifyPassword()`

2. **Rate limiting en login: 5 intentos en 15 minutos**
   - Login: 5 intentos en 15 minutos
   - API general: 100 requests en 1 hora
   - Admin: 50 requests en 1 hora

3. **Helmet y headers de seguridad**
   - Content-Security-Policy (CSP)
   - Strict-Transport-Security (HSTS)
   - X-Content-Type-Options (nosniff)
   - X-Frame-Options (deny clickjacking)
   - X-XSS-Protection

4. **Sesiones con expiración de 24 horas**
   - Access token: 15 minutos (auto-refresh)
   - Refresh token: 30 días
   - Configuración vía Supabase Auth

5. **CSRF básico**
   - Token CSRF manual
   - Middleware para endpoints POST/PUT/DELETE

## Instalación

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Verificar estado del servidor

### Autenticación
- `POST /api/auth/login` - Login (con rate limiting)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Obtener usuario actual

### Admin (requiere autenticación y CSRF)
- `POST /api/admin/*` - Rutas protegidas de administración

## Variables de Entorno

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Servidor
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=tu_secreto_super_seguro

# Sesión
SESSION_EXPIRY_HOURS=24
```

## Testing

```bash
chmod +x test-server.sh
./test-server.sh
```

## Stack Tecnológico

- **Framework:** Express.js (Node.js)
- **Autenticación:** Supabase Auth
- **Hashing:** bcryptjs (salt rounds: 12)
- **Rate Limiting:** express-rate-limit
- **Seguridad:** helmet
- **CORS:** cors
- **Cookie Parser:** cookie-parser

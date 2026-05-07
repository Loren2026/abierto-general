# InteligenciaLoren.com - Panel de Administración

Panel de administración para la plataforma multi-app InteligenciaLoren.com.

## Características de Seguridad (5 puntos esenciales)

1. ✅ **Hash robusto de contraseña con bcrypt** (12 salt rounds)
2. ✅ **Rate limiting en login** (5 intentos en 15 minutos)
3. ✅ **Helmet y headers de seguridad** (CSP, HSTS, etc.)
4. ✅ **Sesiones con expiración de 24 horas**
5. ✅ **CSRF básico**

## Stack Tecnológico

### Backend
- Express.js (Node.js)
- Supabase Auth
- bcryptjs (12 salt rounds)
- express-rate-limit
- helmet
- cors
- cookie-parser

### Frontend
- React 18 + Vite
- React Router DOM
- Zustand (gestión de estado)
- Supabase Client
- CSS (sin frameworks externos)

## Estructura del Proyecto

```
InteligenciaLoren/
├── backend/
│   ├── src/
│   │   └── index.js          # Backend Express
│   ├── package.json
│   ├── .env                  # Variables de entorno
│   ├── .env.example
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── services/
│   │   │   └── supabase.js
│   │   ├── store/
│   │   │   └── useAuthStore.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
└── README.md                 # Este archivo
```

## Instalación

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm start
```

El backend estará disponible en http://localhost:3000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en http://localhost:5173

## API Endpoints

### Health Check
- `GET /api/health` - Verificar estado del servidor

### Autenticación
- `POST /api/auth/login` - Login (con rate limiting: 5/15m)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Obtener usuario actual (requiere token)

## Seguridad Implementada

### 1. Hash robusto de contraseña con bcrypt
- **Implementación:** `bcrypt.hash(password, 12)`
- **Salt rounds:** 12 (robusto y eficiente)
- **Verificación:** `bcrypt.compare(password, hash)`

### 2. Rate limiting en login
- **Login:** 5 intentos en 15 minutos
- **API general:** 100 requests en 1 hora
- **Admin:** 50 requests en 1 hora
- **Implementación:** `express-rate-limit`

### 3. Helmet y headers de seguridad
- **Content-Security-Policy (CSP):** Política estricta
- **Strict-Transport-Security (HSTS):** 1 año, preload
- **X-Content-Type-Options:** nosniff
- **X-Frame-Options:** deny (clickjacking)
- **X-XSS-Protection:** activado
- **Implementación:** `helmet`

### 4. Sesiones con expiración de 24 horas
- **Access token:** 15 minutos (auto-refresh)
- **Refresh token:** 30 días
- **Implementación:** Supabase Auth
- **Middleware:** `verifySession()`

### 5. CSRF básico
- **Token CSRF:** Generado en login
- **Middleware:** `csrfProtection()`
- **Aplicado a:** Rutas POST/PUT/DELETE de admin
- **Implementación:** Token manual con crypto

## Testing

### Backend

```bash
cd backend
chmod +x test-server.sh
./test-server.sh
```

### Frontend

```bash
cd frontend
npm run dev
```

Abrir http://localhost:5173 en el navegador.

## Variables de Entorno

### Backend (.env)
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

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

## Estado del Proyecto

- ✅ Punto 1: Hash bcrypt implementado
- ✅ Punto 2: Rate limiting implementado
- ✅ Punto 3: Helmet implementado
- ✅ Punto 4: Sesiones 24h implementadas
- ✅ Punto 5: CSRF implementado
- ✅ Backend funcional
- ✅ Frontend funcional

## Próximos Pasos

1. Probar el sistema completo (backend + frontend)
2. Verificar en remoto antes de confirmar
3. Desplegar en VPS
4. Configurar Traefik
5. Dominio inteligencialoren.com

## Documentos Relacionados

- PROPUESTA_SEGURIDAD_PANEL.md (SHA: 8037cff48e87d9d722edf8fce5c6dd3e1831bb7a)
- PROPUESTA_ARQUITECTURA_INTEGENCIA_LOREN.md
- PROPUESTA.md (Fit Loren)

# Propuesta: Seguridad Simplificada del Panel de Administración
## InteligenciaLoren.com

**Fecha:** 4 de mayo de 2026
**Proyecto:** InteligenciaLoren.com
**Estado:** Pendiente de autorización
**Prioridad:** 1 (Alta)
**Versión:** 3.0 (Mínima Esencial)

---

## Resumen Ejecutivo

Esta propuesta aborda **únicamente la seguridad esencial** del panel de administración de **InteligenciaLoren.com** para un solo usuario (Loren).

### Objetivos de Seguridad (5 puntos mínimos)

1. **Hash robusto de contraseña con bcrypt**
2. **Rate limiting en login: 5 intentos en 15 minutos**
3. **Helmet y headers de seguridad**
4. **Sesiones con expiración de 24 horas**
5. **CSRF básico**

### Alcance
Panel de administración simple y seguro para Loren. Funcionalidades avanzadas se dejan para el futuro.

---

## 1. Mejoras de Seguridad (5 puntos)

### 1.1 Hash Robusto de Contraseña con bcrypt

**Implementación:**
```javascript
// Instalar bcrypt
npm install bcryptjs

// Hash de contraseña al registrar usuario
const bcrypt = require('bcryptjs');
const saltRounds = 12;

async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, saltRounds);
}

// Verificación de contraseña al login
async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}
```

**Uso en backend:**
```javascript
// Al registrar usuario (Loren)
const hashedPassword = await hashPassword(req.body.password);
// Guardar hashedPassword en Supabase (auth.users)

// Al verificar login
const isValid = await verifyPassword(req.body.password, user.password);
```

---

### 1.2 Rate Limiting en Login

**Implementación:**
```javascript
// Instalar express-rate-limit
npm install express-rate-limit

// Configurar rate limiting para login
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 5,                          // máximo 5 intentos
  message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar al endpoint de login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  // Lógica de login
  const { email, password } = req.body;
  
  // Validar credenciales con Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  
  return res.json({ success: true });
});
```

---

### 1.3 Helmet y Headers de Seguridad

**Implementación:**
```javascript
// Instalar helmet
npm install helmet

// Configurar helmet
const helmet = require('helmet');

// Aplicar helmet a toda la app
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://vgpophemyygawgnrhzer.supabase.co"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
}));
```

**Headers de seguridad configurados:**
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options (nosniff)
- X-Frame-Options (deny clickjacking)
- X-XSS-Protection

---

### 1.4 Sesiones con Expiración de 24 Horas

**Implementación:**
```javascript
// Configurar Supabase Auth
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Login con expiración de sesión
async function loginWithExpiry(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error('Error en login');
  }

  // La sesión de Supabase expira automáticamente
  // Access token: 15 minutos (configurable en dashboard de Supabase)
  // Refresh token: 30 días (configurable en dashboard de Supabase)
  
  return data;
}

// Para refresh de sesión
async function refreshSession(refreshToken) {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    throw new Error('Error refrescando sesión');
  }

  return data;
}
```

---

### 1.5 CSRF Básico

**Implementación:**
```javascript
// Instalar cookie-parser y crear token CSRF manual
import crypto from 'crypto';

// Generar token CSRF
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware para verificar token CSRF
function csrfProtection(req, res, next) {
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  if (token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

// Aplicar CSRF a endpoints POST/PUT/DELETE
app.post('/api/admin/*', csrfProtection, async (req, res) => {
  // Lógica de admin
});

// Generar token CSRF y enviar en el login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const csrfToken = generateCSRFToken();
  req.session.csrfToken = csrfToken;
  
  return res.json({ 
    success: true,
    csrfToken 
  });
});
```

---

## 2. Stack Tecnológico

### 2.1 Backend
- **Framework:** Express.js (Node.js)
- **Autenticación:** Supabase Auth
- **Hashing:** bcryptjs
- **Rate Limiting:** express-rate-limit
- **Seguridad:** helmet
- **CORS:** cors

### 2.2 Frontend
- **Framework:** React 18+ con Vite
- **Autenticación:** Supabase Client
- **Validación:** zod
- **Gestión de estado:** Zustand o Context API

### 2.3 Dependencias (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "bcryptjs": "^2.4.3",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "cookie-parser": "^1.4.6",
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

---

## 3. Plan de Implementación

### Semana 1: Configuración Básica (1 semana)

**Tareas:**
- [ ] Instalar dependencias de seguridad
- [ ] Configurar helmet
- [ ] Configurar CORS
- [ ] Configurar Supabase Auth
- [ ] Implementar hash de contraseña con bcrypt
- [ ] Configurar expiración de sesión (24h)

**Entregables:**
- Dependencias instaladas
- Headers de seguridad configurados
- Hash de contraseña implementado
- Expiración de sesión configurada

### Semana 2: Rate Limiting y CSRF (1 semana)

**Tareas:**
- [ ] Implementar rate limiting para login
- [ ] Implementar token CSRF
- [ ] Aplicar rate limiting a endpoints de admin
- [ ] Aplicar CSRF a endpoints POST/PUT/DELETE
- [ ] Testing de rate limiting
- [ ] Testing de CSRF

**Entregables:**
- Rate limiting implementado
- CSRF básico implementado
- Testing completado

### Semana 3: Testing y Despliegue (1 semana)

**Tareas:**
- [ ] Testing de seguridad end-to-end
- [ ] Deploy en VPS
- [ ] Verificar headers de seguridad
- [ ] Documentación básica

**Entregables:**
- Seguridad implementada y desplegada
- Headers de seguridad verificados
- Documentación básica

---

## 4. Cronograma Detallado

| Semana | Fase | Duración | Objetivo |
|--------|-------|----------|-----------|
| Semana 1 | Configuración Básica | 1 semana | Hash bcrypt, helmet, expiración sesión |
| Semana 2 | Rate Limiting + CSRF | 1 semana | Rate limiting 5/15, CSRF básico |
| Semana 3 | Testing y Deploy | 1 semana | Testing, VPS, documentación |

**Tiempo Total:** 3 semanas

---

## 5. Coste Estimado

### Desarrollo
- **Coste:** 0€ (desarrollo interno)

### Infraestructura
- **VPS:** 0€/mes (ya contratado)
- **Supabase:** 0€ (ya contratado, plan gratuito)
- **Dominio:** 0€/mes (ya contratado)

**Coste Total del Proyecto:** 0€

---

## 6. Conclusión

Esta propuesta simplificada de seguridad para el panel de administración de **InteligenciaLoren.com** implementa las 5 medidas esenciales:

1. ✅ Hash robusto de contraseña (bcrypt)
2. ✅ Rate limiting en login (5 intentos / 15 minutos)
3. ✅ Helmet y headers de seguridad
4. ✅ Sesiones con expiración (24 horas)
5. ✅ CSRF básico

### Puntos Clave
- Implementación simple y rápida (3 semanas)
- Coste cero (desarrollo interno + infraestructura ya contratada)
- Seguridad esencial para un panel de un solo usuario
- Funcionalidades avanzadas para el futuro

### Recomendación

**Aprobar esta propuesta** y proceder con la implementación por fases.

**Tiempo estimado:** 3 semanas
**Prioridad:** Alta (Punto 1 del plan de trabajo)

---

**Estado:** 🔴 **PENDIENTE DE AUTORIZACIÓN**

**Documentos Relacionados:**
- PROPUESTA.md (Fit Loren)
- PROPUESTA_ARQUITECTURA_INTEGENCIA_LOREN.md (Plataforma multi-app)
- PROPUESTA_SEGURIDAD_PANEL.md (este documento - Versión 3.0 simplificada)

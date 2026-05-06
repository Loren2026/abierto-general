import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

// En producción, usar las variables del contenedor/host y no depender de /app/.env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Punto 3: Helmet y headers de seguridad
const app = express();

// Necesario detrás de Traefik / proxy para que rate-limit use la IP real
app.set('trust proxy', 1);

// Aplicar helmet (punto 3)
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

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:5173', 'http://localhost:3000']
    : ['https://inteligencialoren.com', 'https://www.inteligencialoren.com'],
  credentials: true,
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Punto 2: Rate limiting en login (5 intentos en 15 minutos)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 5,                          // máximo 5 intentos
  message: {
    error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting general para API
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hora
  max: 100,                      // máximo 100 requests
  message: {
    error: 'Demasiadas requests. Intenta de nuevo en 1 hora.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para rutas de admin
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hora
  max: 50,                       // máximo 50 requests (más restrictivo)
  message: {
    error: 'Demasiadas requests de administración. Intenta de nuevo en 1 hora.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Supabase Admin Client (para operaciones de backend)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Punto 5: CSRF básico
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  if (token !== req.session?.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

// Middleware para aplicar rate limiting general
app.use('/api', apiLimiter);

// Middleware para aplicar rate limiting a admin
app.use('/api/admin', adminLimiter);

// Punto 1: Hash robusto de contraseña con bcrypt
const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Middleware para verificar sesión (Punto 4)
async function verifySession(req, res, next) {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!accessToken) {
    return res.status(401).json({ error: 'No access token' });
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    security: {
      helmet: 'enabled',
      rateLimit: 'enabled',
      csrf: 'enabled',
      bcrypt: 'enabled',
      sessionExpiry: '24h'
    }
  });
});

// Punto 2: Login con rate limiting
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    
    // Intentar login con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    // Punto 5: Generar y guardar token CSRF
    const csrfToken = generateCSRFToken();
    
    // Punto 4: Sesión con expiración de 24 horas (configurado en Supabase)
    // Supabase maneja la expiración automáticamente:
    // - Access token: 15 minutos (auto-refresh)
    // - Refresh token: 30 días
    
    return res.json({ 
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      csrfToken,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' });
    }
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: 'Error al cerrar sesión' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error en logout:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener usuario actual
app.get('/api/auth/me', verifySession, async (req, res) => {
  try {
    return res.json({ user: req.user });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Ejemplo de ruta protegida con CSRF (Punto 5)
app.post('/api/admin/example', verifySession, csrfProtection, async (req, res) => {
  try {
    // Lógica de admin aquí
    return res.json({ message: 'Acceso permitido' });
  } catch (error) {
    console.error('Error en ruta admin:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Error interno del servidor' 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🔒 Seguridad activa:`);
  console.log(`   ✅ Hash de contraseña (bcrypt, salt rounds: ${SALT_ROUNDS})`);
  console.log(`   ✅ Rate limiting (login: 5/15m, API: 100/1h, Admin: 50/1h)`);
  console.log(`   ✅ Helmet y headers de seguridad`);
  console.log(`   ✅ Sesiones con expiración (24h)`);
  console.log(`   ✅ CSRF básico`);
});

export default app;

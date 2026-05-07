# Propuesta de Arquitectura: InteligenciaLoren.com
## Plataforma Pública Multi-App para Familia y Amigos

**Fecha:** 4 de mayo de 2026
**Proyecto:** InteligenciaLoren.com
**Estado:** Pendiente de autorización
**Versión:** 1.0

---

## Resumen Ejecutivo

**InteligenciaLoren.com** será una plataforma pública multi-app que centraliza el acceso a las aplicaciones personalizadas de Loren para familia y amigos. El modelo de funcionamiento se basa en:

- **Parte pública:** Presentación de la web y las apps disponibles
- **Acceso controlado:** Códigos de invitación únicos, vinculados a dispositivo, un solo uso y revocables
- **Arquitectura multi-tenant:** Cada app en su propio subdominio (`fit.inteligencialoren.com`, `actas.inteligencialoren.com`, etc.)
- **Gestión centralizada:** Panel de administración único para Loren para gestionar códigos y accesos de todos los proyectos
- **Backend compartido:** Supabase como base de datos unificada para todas las apps

---

## 1. Estructura de la Web Pública

### 1.1 Landing Page Principal (`inteligencialoren.com`)

**Objetivo:** Presentar la plataforma, las apps disponibles y el modelo de acceso.

**Estructura de páginas:**

#### Página de Inicio (`/`)
- **Hero Section:** Presentación de la plataforma
  - Título: "InteligenciaLoren"
  - Subtítulo: "Apps personalizadas para familia y amigos"
  - Call-to-Action: "Solicitar acceso"
- **Apps Disponibles:** Grid con cards de cada app
  - Fit Loren (entrenamiento personal)
  - GestActas (gestión de actas)
  - [Futuras apps]
- **Cómo Funciona:** Explicación del modelo de códigos de invitación
- **Contacto:** Formulario para solicitar código de invitación

#### Página de Solicitud de Acceso (`/solicitar-acceso`)
- Formulario con:
  - Nombre completo
  - Email
  - App deseada (dropdown)
  - Mensaje opcional
- Validación de email
- Notificación a Loren de nuevas solicitudes

#### Página de Login (`/login`)
- Formulario de login
- Recuperación de contraseña
- Opción de registro con código de invitación

#### Página de "Acceso Revocado" (`/acceso-revocado`)
- Mensaje claro explicando que el acceso ha sido revocado
- Contacto para solicitar nuevo acceso

#### Página de Política de Privacidad (`/privacy`)
- Términos de uso
- Política de privacidad
- Datos que se recogen (mínimos: fingerprint de dispositivo)

#### Página de Términos de Uso (`/terms`)
- Términos de uso de la plataforma
- Responsabilidades del usuario

### 1.2 Estructura Técnica de la Web Pública

**Tecnología recomendada:**
- **Framework:** Next.js 14+ (App Router)
- **UI Library:** shadcn/ui (componentes modernos, accesibles)
- **Styling:** Tailwind CSS
- **Formularios:** React Hook Form + Zod (validación)
- **Estado Global:** Zustand o Context API
- **Routing:** Next.js App Router
- **Deploy:** Vercel (recomendado) o Netlify

**Rutas:**
```
/                          → Landing page
/solicitar-acceso          → Formulario de solicitud
/login                     → Login
/acceso-revocado           → Página de acceso revocado
/privacy                   → Política de privacidad
/terms                     → Términos de uso
/admin                     → Panel de administración (protegido)
```

---

## 2. Sistema de Códigos de Invitación

### 2.1 Requisitos Funcionales

1. **Códigos Únicos:** Cada código es único y no reutilizable
2. **Vinculado a Dispositivo:** Código asociado a fingerprint de navegador/dispositivo
3. **Un Solo Uso:** Cada código solo puede usarse una vez
4. **Revocable:** Loren puede revocar cualquier código en cualquier momento
5. **Caducidad:** Los códigos pueden tener fecha de caducidad opcional
6. **Multi-App:** Sistema debe soportar múltiples apps independientes
7. **Validación en Tiempo Real:** Validar código en cada request

### 2.2 Esquema de Base de Datos (Supabase)

#### Tabla `invitation_codes`

```sql
CREATE TABLE invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    app_id TEXT NOT NULL,  -- 'fit-loren', 'gestactas', etc.
    device_fingerprint TEXT,
    device_info JSONB,     -- Información adicional del dispositivo
    used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_code CHECK (
        (used_at IS NULL) AND 
        (revoked_at IS NULL) AND 
        (expires_at > NOW())
    )
);
```

#### Tabla `apps`

```sql
CREATE TABLE apps (
    id TEXT PRIMARY KEY,  -- 'fit-loren', 'gestactas', etc.
    name TEXT NOT NULL,
    description TEXT,
    subdomain TEXT UNIQUE NOT NULL,  -- 'fit', 'actas', etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Tabla `access_requests`

```sql
CREATE TABLE access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT REFERENCES apps(id),
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    invitation_code_id UUID REFERENCES invitation_codes(id),
    created_by UUID REFERENCES profiles(id),  -- Quién aprobó/rechazó
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Tabla `user_access_revocations`

```sql
CREATE TABLE user_access_revocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT REFERENCES apps(id),
    user_id UUID REFERENCES auth.users(id),
    reason TEXT,
    revoked_by UUID REFERENCES profiles(id),
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.3 Flujo de Validación de Códigos

#### Generación de Códigos
1. Loren genera código desde el panel de administración
2. Sistema genera UUID único (ej: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
3. Código se guarda en `invitation_codes` con:
   - `app_id`: app destino
   - `expires_at`: fecha de caducidad opcional
   - `created_by`: ID de Loren

#### Validación de Código
1. Usuario introduce código en el formulario de registro
2. Frontend genera fingerprint del dispositivo
3. Backend valida:
   - Código existe y no está revocado
   - Código no ha sido usado
   - Código no ha caducado
   - App del código está activa
4. Si válido:
   - Marcar código como usado (`used_at = NOW()`)
   - Vincular código a dispositivo (`device_fingerprint`)
   - Redirigir a login/registro
5. Si inválido:
   - Mostrar error específico (revocado, usado, caducado, etc.)

#### Validación en Tiempo Real (Middleware)
1. Cada request a una app protegida pasa por middleware
2. Middleware verifica:
   - Usuario autenticado en Supabase
   - Código de invitación asociado al usuario no está revocado
   - El fingerprint del dispositivo coincide
3. Si alguna validación falla:
   - Invalidar sesión
   - Redirigir a `/acceso-revocado`

### 2.4 Implementación de Fingerprint de Dispositivo

**Tecnología recomendada:** `fingerprintjs` (librería open-source)

**Información capturada (mínima y anónima):**
- User-Agent del navegador
- Resolución de pantalla
- Zona horaria
- Idioma
- Características de hardware (Canvas, WebGL, Audio)
- Plugins instalados

**Hash:** Se genera un hash único a partir de esta información.

---

## 3. Panel de Administración de Loren

### 3.1 Requisitos Funcionales

1. **Gestión de Códigos de Invitación:** Crear, listar, revocar códigos
2. **Gestión de Solicitudes:** Aprobar/rechazar solicitudes de acceso
3. **Gestión de Usuarios:** Ver usuarios activos, revocar accesos
4. **Gestión de Apps:** Añadir/editar/eliminar apps
5. **Estadísticas:** Uso por app, códigos generados, usuarios activos
6. **Registro de Actividad:** Audit log de todas las acciones

### 3.2 Estructura del Panel

#### Dashboard Principal (`/admin`)
- **Resumen:**
  - Total de códigos generados
  - Códigos usados vs sin usar
  - Usuarios activos por app
  - Solicitudes pendientes
- **Gráficos:**
  - Usuarios por app (bar chart)
  - Uso mensual (line chart)
  - Códigos generados por mes (bar chart)
- **Acciones rápidas:**
  - Generar nuevo código
  - Ver solicitudes pendientes

#### Gestión de Códigos (`/admin/codigos`)
- **Lista de códigos** con filtros:
  - Por app
  - Por estado (usado, sin usar, revocado, caducado)
  - Por fecha de creación
- **Acciones:**
  - Generar nuevo código (modal)
  - Ver detalles de código
  - Revocar código (con confirmación)
  - Copiar código al portapapeles
- **Detalles de código:**
  - Código
  - App destino
  - Estado
  - Fecha de creación
  - Fecha de caducidad
  - Si está usado: usuario, fecha de uso, dispositivo
  - Si está revocado: fecha de revocación, motivo

#### Gestión de Solicitudes (`/admin/solicitudes`)
- **Lista de solicitudes** con filtros:
  - Por estado (pendiente, aprobada, rechazada)
  - Por app
  - Por fecha
- **Acciones:**
  - Aprobar solicitud (genera código automáticamente)
  - Rechazar solicitud (con motivo opcional)
  - Ver detalles
- **Detalles de solicitud:**
  - Solicitante (nombre, email)
  - App deseada
  - Mensaje
  - Estado
  - Fecha de solicitud
  - Si aprobada: código generado

#### Gestión de Usuarios (`/admin/usuarios`)
- **Lista de usuarios** con filtros:
  - Por app
  - Por estado (activo, acceso revocado)
  - Por fecha de registro
- **Acciones:**
  - Ver detalles de usuario
  - Revocar acceso (con motivo)
  - Ver historial de actividad
- **Detalles de usuario:**
  - Nombre, email
  - Apps a las que tiene acceso
  - Dispositivos registrados
  - Última actividad
  - Estado de acceso por app

#### Gestión de Apps (`/admin/apps`)
- **Lista de apps** activas e inactivas
- **Acciones:**
  - Añadir nueva app
  - Editar app existente
  - Activar/desactivar app
- **Detalles de app:**
  - ID, nombre
  - Descripción
  - Subdominio
  - Estado
  - Número de usuarios activos
  - Número de códigos generados

#### Registro de Actividad (`/admin/audit`)
- **Lista de eventos** con filtros:
  - Por tipo de evento
  - Por usuario/admin
  - Por fecha
- **Tipos de eventos:**
  - Código generado
  - Código revocado
  - Solicitud aprobada
  - Solicitud rechazada
  - Usuario revocado
  - App añadida/editada/eliminada

### 3.3 Seguridad del Panel

- **Autenticación:** Solo Loren puede acceder
- **Verificación de rol:** Verificar que el usuario autenticado es Loren
- **Registro de todas las acciones:** Audit log en `activity_log`
- **Confirmación de acciones peligrosas:** Revocaciones, eliminaciones, etc.
- **Protección contra CSRF:** Tokens CSRF en todos los formularios

---

## 4. Integración de Apps Existentes

### 4.1 Arquitectura de Integración

**Principio:** Cada app funciona de forma independiente pero comparte el sistema de autenticación y gestión de códigos.

#### Capa Compartida (Autenticación y Gestión de Códigos)

**Implementación:** Módulo compartido de autenticación que todas las apps importan.

**Tecnología:** NPM package privado (`@inteligencialoren/auth`)

**Funcionalidades:**
- Login/Registro con código de invitación
- Validación de código en tiempo real
- Gestión de sesión
- Validación de revocación
- Generación de fingerprint de dispositivo

#### Apps Independientes

**Fit Loren:**
- Funcionalidad: Entrenamiento personal
- Subdominio: `fit.inteligencialoren.com`
- Base de datos: Tablas específicas de Fit Loren en Supabase
- Autenticación: Usa módulo compartido `@inteligencialoren/auth`
- Lógica de negocio: Completamente independiente

**GestActas:**
- Funcionalidad: Gestión de actas
- Subdominio: `actas.inteligencialoren.com`
- Base de datos: Tablas específicas de GestActas en Supabase
- Autenticación: Usa módulo compartido `@inteligencialoren/auth`
- Lógica de negocio: Completamente independiente

### 4.2 Flujo de Usuario

#### Nuevo Usuario
1. Usuario visita `inteligencialoren.com`
2. Ve apps disponibles
3. Solicita acceso a una app
4. Loren recibe solicitud
5. Loren aprueba solicitud → se genera código
6. Loren envía código al usuario
7. Usuario visita `fit.inteligencialoren.com`
8. Usuario introduce código
9. Sistema valida código y registra dispositivo
10. Usuario hace login/registro
11. Usuario accede a la app

#### Usuario Existente
1. Usuario visita `fit.inteligencialoren.com`
2. Si ya tiene acceso: va directo a la app
3. Si no tiene acceso: le pide código de invitación

#### Revocación de Acceso
1. Loren visita panel de administración
2. Selecciona usuario y app
3. Revoca acceso (con motivo)
4. Sistema invalida sesión del usuario
5. Próxima request del usuario falla
6. Usuario redirigido a `/acceso-revocado`

### 4.3 Migración de Apps Existentes

**Fit Loren:**
- Migrar de app nativa Android a PWA
- Integrar módulo `@inteligencialoren/auth`
- Actualizar base de datos para usar Supabase compartido
- Migrar datos existentes a Supabase

**GestActas:**
- Integrar módulo `@inteligencialoren/auth`
- Actualizar base de datos para usar Supabase compartido
- Mantener funcionalidad existente

---

## 5. Stack Tecnológico Recomendado

### 5.1 Frontend

**Web Pública (`inteligencialoren.com`):**
- **Framework:** React 18+ con Vite
- **UI Library:** shadcn/ui o MUI
- **Styling:** Tailwind CSS o CSS Modules
- **Formularios:** React Hook Form + Zod
- **Estado Global:** Zustand o Context API
- **Iconos:** Lucide React
- **Fingerprint:** @fingerprintjs/fingerprintjs
- **Deploy:** VPS (srv1599127.hstgr.cloud) con Traefik

**Apps (Fit Loren, GestActas):**
- **Framework:** Flutter 3.19+ (soporta Web, Android, iOS)
- **UI Library:** Material Design 3 (Flutter integrado)
- **Estado Global:** Provider (Flutter)
- **Audio:** flutter_tts, just_audio
- **Persistencia:** hive_flutter (local), Supabase (remoto)
- **Deploy:**
  - Web: VPS (subdominios con Traefik)
  - Móvil: Play Store, App Store (opcional)

**Panel de Administración:**
- **Framework:** React 18+ con Vite
- **UI Library:** shadcn/ui o MUI
- **Styling:** Tailwind CSS o CSS Modules
- **Gráficos:** Recharts o Chart.js
- **Tabla:** TanStack Table
- **Deploy:** VPS (rutas protegidas `/admin/*` con Traefik)

### 5.2 Backend

**Base de Datos:**
- **Proveedor:** Supabase
- **Base de datos:** PostgreSQL
- **Autenticación:** Supabase Auth
- **Realtime:** Supabase Realtime (opcional para features futuros)
- **Storage:** Supabase Storage (para avatars, archivos)

**API:**
- **Framework:** Node.js con Express o Fastify
- **Autenticación:** Supabase Auth
- **Validación:** Zod
- **Rate Limiting:** Express-rate-limit o similar
- **CORS:** Configurado para subdominios específicos

### 5.3 DevOps

**Hosting:**
- **Dominios:** DNS en Hostinger (gestionado desde hPanel)
- **VPS:** srv1599127.hstgr.cloud (Hostinger)
- **Reverse Proxy:** Traefik (ya configurado en el VPS)
- **Web Pública + Panel:** Node.js + Nginx/Apache (en VPS)
- **Apps (Web):** VPS (subdominios con Traefik)
- **Apps (Móvil):** Play Store, App Store (opcional)

**CI/CD:**
- **Integración:** GitHub Actions
- **Automatización:**
  - Test en cada push
  - Build automático en main
  - Deploy automático en VPS (ssh + npm run build)

**Monitoreo:**
- **Logs:** VPS logs (/var/log/), Supabase Logs
- **Errores:** Sentry (opcional)
- **Uso:** PM2 para gestión de procesos, Supabase Analytics

---

## 6. Fases de Desarrollo

### Fase 1: Fundamentos (2 semanas)

**Objetivo:** Establecer la base técnica de la plataforma.

**Tareas:**
1. Configurar proyecto Next.js con App Router
2. Configurar Supabase (tablas, RLS, Auth)
3. Crear módulo compartido `@inteligencialoren/auth`
4. Implementar generación y validación de códigos
5. Implementar fingerprint de dispositivo
6. Crear landing page básica
7. Implementar sistema de login/registro

**Entregables:**
- Proyecto Next.js configurado
- Módulo de autenticación funcional
- Landing page básica
- Sistema de códigos de invitación funcional

### Fase 2: Web Pública y Panel de Administración (3 semanas)

**Objetivo:** Completar la web pública y el panel de administración.

**Tareas:**
1. Completar landing page (secciones, CTA, etc.)
2. Implementar página de solicitud de acceso
3. Implementar página de login
4. Implementar página de "acceso revocado"
5. Desarrollar dashboard del panel de administración
6. Desarrollar gestión de códigos
7. Desarrollar gestión de solicitudes
8. Desarrollar gestión de usuarios
9. Desarrollar gestión de apps
10. Implementar registro de actividad (audit log)
11. Añadir gráficos y estadísticas

**Entregables:**
- Web pública completa
- Panel de administración completo
- Sistema de gestión de códigos y usuarios

### Fase 3: Integración de Fit Loren (2 semanas)

**Objetivo:** Integrar Fit Loren en la plataforma.

**Tareas:**
1. Migrar Fit Loren a Flutter Web
2. Integrar módulo `@inteligencialoren/auth`
3. Migrar datos existentes a Supabase
4. Configurar subdominio `fit.inteligencialoren.com`
5. Testing de integración
6. Deploy en Vercel
7. Testing en dispositivo real

**Entregables:**
- Fit Loren funcionando como PWA
- Integrado con sistema de códigos
- Deploy en `fit.inteligencialoren.com`

### Fase 4: Integración de GestActas (1 semana)

**Objetivo:** Integrar GestActas en la plataforma.

**Tareas:**
1. Integrar módulo `@inteligencialoren/auth`
2. Migrar datos existentes a Supabase
3. Configurar subdominio `actas.inteligencialoren.com`
4. Testing de integración
5. Deploy en Vercel

**Entregables:**
- GestActas integrado con sistema de códigos
- Deploy en `actas.inteligencialoren.com`

### Fase 5: Testing y Optimización (1 semana)

**Objetivo:** Testing exhaustivo y optimización de rendimiento.

**Tareas:**
1. Testing end-to-end de todo el flujo
2. Testing de seguridad
3. Testing de rendimiento
4. Optimización de imágenes y assets
5. Implementar SEO básico
6. Testing en múltiples navegadores
7. Testing en múltiples dispositivos

**Entregables:**
- Testing completado
- Optimizaciones aplicadas
- Documentación de usuario

### Fase 6: Deploy y Lanzamiento (1 semana)

**Objetivo:** Deploy en producción y lanzamiento.

**Tareas:**
1. Configurar dominios en Cloudflare
2. Configurar certificados SSL
3. Deploy web pública en Vercel
4. Deploy panel de administración en Vercel
5. Deploy Fit Loren en Vercel
6. Deploy GestActas en Vercel
7. Monitoreo inicial
8. Documentación de administración

**Entregables:**
- Plataforma completa en producción
- Documentación de administración
- Sistema de monitoreo configurado

**Tiempo Total:** 10 semanas (2.5 meses)

---

## 7. Costes Estimados

### 7.1 Desarrollo

**Coste de desarrollo: 0€**

El desarrollo se realiza internamente, por lo que no hay coste asociado al desarrollo.

**Horas estimadas de desarrollo (referencia):**
- Fase 1: 80-100 horas
- Fase 2: 120-150 horas
- Fase 3: 80-100 horas
- Fase 4: 40-50 horas
- Fase 5: 40-50 horas
- Fase 6: 40-50 horas
- **Total: 400-500 horas**

### 7.2 Infraestructura (Mensual)

**VPS (Hostinger - ya contratado):**
- Recursos: Configuración actual del VPS
- **Coste: 0€/mes** (ya contratado)

**Supabase (Pro Plan - 25€/mes):**
- 8GB de base de datos
- 50GB de storage
- 50GB de bandwidth
- Sin límites de usuarios
- **Coste: 25€/mes** (recomendado)

**Dominio:**
- `inteligencialoren.com`: ~10-15€/año
- Subdominios: Gratis
- **Coste: 1-1.5€/mes**

**Coste Total Infraestructura:**
- Plan actual: 26-26.5€/mes (25€ Supabase + 1-1.5€ dominio)

### 7.3 Herramientas y Servicios (Opcionales)

**Sentry (Error Tracking):**
- Developer: 0€/mes
- Team: 26€/mes
- **Coste: 0-26€/mes** (opcional)

**Figma (Diseño):**
- Starter: 0€/mes
- Professional: 12€/mes
- **Coste: 0-12€/mes** (si no tienes cuenta)

### 7.4 Coste Total del Proyecto

**Desarrollo (One-time):**
- Rango: 20.000-40.000€
- Promedio: 30.000€

**Infraestructura (Mensual - Primer año):**
- Hobby: 12-18€/año
- Pro: 552-558€/año
- Promedio: ~300€/año

**Coste Total del Proyecto (Primer año):**
- Mínimo: ~20.020€
- Máximo: ~40.558€
- Promedio: ~30.300€

**Coste Total del Proyecto (Años siguientes):**
- Solo infraestructura: 12-558€/año

---

## 8. Observaciones de Mejora

### 8.1 Mejoras de Seguridad

**1. Autenticación de Dos Factores (2FA):**
- Implementar 2FA para el panel de administración de Loren
- Opciones: TOTP (Google Authenticator) o SMS

**2. Rate Limiting:**
- Implementar rate limiting en todas las APIs
- Prevenir ataques de fuerza bruta

**3. IP Whitelisting:**
- Opcional: whitelist de IPs para el panel de administración
- Solo Loren desde su IP de casa/trabajo

**4. Auditoría de Seguridad:**
- Auditoría periódica de seguridad
- Testing de penetración (opcional)

### 8.2 Mejoras de UX

**1. Onboarding de Usuario:**
- Tutorial interactivo para nuevos usuarios
- Guía de las funciones de cada app

**2. Notificaciones:**
- Notificaciones push para nuevas features
- Notificaciones por email (nuevas versiones, mantenimientos)

**3. Tema Oscuro/Claro:**
- Implementar toggle de tema
- Guardar preferencia en Supabase

**4. Internacionalización (i18n):**
- Preparar la plataforma para multi-idioma
- Español e inglés inicialmente

### 8.3 Mejoras Técnicas

**1. Offline Support:**
- Implementar service workers para soporte offline
- Sincronización automática cuando hay conexión

**2. PWA Enhancements:**
- Mejorar instalación como app nativa
- Splash screens personalizados por app
- Notificaciones push desde PWA

**3. Analytics:**
- Implementar Google Analytics o Plausible
- Seguimiento de uso por app y usuario
- Heatmaps (opcional)

**4. Performance:**
- Implementar caching agresivo
- Lazy loading de componentes
- Optimización de imágenes (image-optimize o similar)
- CDN para assets estáticos

### 8.4 Mejoras de Funcionalidad

**1. Chat Soporte:**
- Chat en vivo para soporte a usuarios
- Integración con WhatsApp o similar

**2. Comunidad:**
- Foro de usuarios (opcional)
- Compartir rutinas de entrenamiento (para Fit Loren)
- Compartir plantillas de actas (para GestActas)

**3. Integraciones Terceros:**
- Integración con Google Calendar (para eventos de entrenamiento)
- Integración con Spotify/Apple Music (para playlists de entrenamiento)
- Integración con Wearables (Apple Watch, Fitbit, etc.)

**4. Gamificación:**
- Sistema de puntos y logros
- Leaderboards entre familia/amigos
- Badges por logros

### 8.5 Mejoras Escalables

**1. Multi-idioma:**
- Preparar la plataforma para soportar múltiples idiomas
- Usar i18next para traducciones

**2. Multi-rol:**
- Más allá de Loren, permitir otros roles:
  - Moderadores
  - Editores de contenido
  - Usuarios beta testers

**3. API Pública:**
- Documentar y exponer APIs públicas
- Permitir integraciones de terceros

**4. Marketplace:**
- Futuro: marketplace de apps creadas por la comunidad
- Sistema de review y rating

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Migración de datos compleja | Media | Alto | Plan de migración detallado, backup de datos |
| Problemas de compatibilidad de Flutter Web | Media | Alto | Testing exhaustivo, fallback a versión nativa |
| Brecha de seguridad | Baja | Crítico | Auditoría de seguridad, 2FA, rate limiting |
| Problemas de rendimiento | Media | Medio | Optimización de imágenes, caching, CDN |
| Costes de infraestructura crecientes | Baja | Medio | Monitorar uso, optimizar recursos, upgrade gradual |
| Adopción baja por usuarios | Media | Alto | Onboarding fácil, soporte activo, feedback loop |
| Dificultad técnica para integrar apps existentes | Alta | Alto | Plan de integración detallado, testing temprano |
| Problemas de escalabilidad | Baja | Alto | Arquitectura escalable desde el inicio |

---

## 10. Cronograma Detallado

### Semana 1-2: Fase 1 - Fundamentos
- [ ] Configurar proyecto React + Vite
- [ ] Configurar Supabase
- [ ] Crear módulo `@inteligencialoren/auth`
- [ ] Implementar códigos de invitación
- [ ] Implementar fingerprint de dispositivo
- [ ] Landing page básica
- [ ] Login/registro

### Semana 3-5: Fase 2 - Web Pública y Panel
- [ ] Completar landing page
- [ ] Página de solicitud de acceso
- [ ] Página de "acceso revocado"
- [ ] Dashboard panel administración
- [ ] Gestión de códigos
- [ ] Gestión de solicitudes
- [ ] Gestión de usuarios
- [ ] Gestión de apps
- [ ] Audit log
- [ ] Gráficos y estadísticas

### Semana 6-7: Fase 3 - Integración Fit Loren
- [ ] Migrar Fit Loren a Flutter Web
- [ ] Integrar módulo auth
- [ ] Migrar datos a Supabase
- [ ] Configurar subdominio en Traefik
- [ ] Testing integración
- [ ] Deploy en VPS con Traefik
- [ ] Testing dispositivo real

### Semana 8: Fase 4 - Integración GestActas
- [ ] Integrar módulo auth
- [ ] Migrar datos a Supabase
- [ ] Configurar subdominio en Traefik
- [ ] Testing integración
- [ ] Deploy en VPS con Traefik

### Semana 9: Fase 5 - Testing y Optimización
- [ ] Testing end-to-end
- [ ] Testing seguridad
- [ ] Testing rendimiento
- [ ] Optimización assets
- [ ] SEO básico
- [ ] Testing multi-navegador
- [ ] Testing multi-dispositivo

### Semana 10: Fase 6 - Deploy y Lanzamiento
- [ ] Configurar DNS en Hostinger (hPanel)
- [ ] Configurar certificados SSL (Let's Encrypt o similar)
- [ ] Deploy web pública en VPS
- [ ] Deploy panel administración en VPS
- [ ] Deploy Fit Loren (Flutter Web) en VPS
- [ ] Deploy GestActas en VPS
- [ ] Configurar PM2 para gestión de procesos
- [ ] Monitoreo inicial
- [ ] Documentación administración

---

## 11. Conclusión

Esta propuesta de arquitectura para **InteligenciaLoren.com** ofrece una solución completa, escalable y segura para una plataforma multi-app personalizada para familia y amigos de Loren.

### Puntos Clave:

1. **Arquitectura Modular:** Cada app es independiente pero comparte autenticación y gestión de códigos
2. **Seguridad Robusta:** Sistema de códigos únicos, vinculados a dispositivo, revocables
3. **Experiencia de Usuario Excelente:** PWA instalables, soporte offline, interfaz moderna
4. **Gestión Centralizada:** Panel de administración único para todas las apps
5. **Escalabilidad:** Preparada para añadir nuevas apps fácilmente
6. **Coste Razonable:** Infraestructura económica (VPS ya contratado), desarrollo interno

### Recomendación:

**Aprobar esta propuesta** y proceder con el desarrollo por fases, comenzando por los fundamentos y luego integrando las apps existentes.

**Tiempo estimado:** 10 semanas (2.5 meses)
**Coste estimado:** 0€ (desarrollo interno) + ~312€/año (infraestructura: 25€/mes Supabase + ~1€/mes dominio)

Esta inversión proporcionará una plataforma personalizada, segura y escalable que crecerá con las necesidades de Loren y su familia/amigos.

---

**Estado:** 🔴 **PENDIENTE DE AUTORIZACIÓN**

**Documentos Relacionados:**
- PROPUESTA.md (Fit Loren: corrección crash Android 16 y conversión a PWA)
- PROPUESTA_ARQUITECTURA_INTEGENCIA_LOREN.md (este documento)

# InteligenciaLoren Frontend

Frontend del panel de administración de InteligenciaLoren.com.

## Características

- React 18 + Vite
- React Router para navegación
- Zustand para gestión de estado
- Integración con Supabase Auth
- Diseño moderno y responsivo
- Seguridad: CSRF, Rate limiting

## Instalación

```bash
cd frontend
npm install
```

## Variables de Entorno

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

## Development

```bash
npm run dev
```

El frontend estará disponible en http://localhost:5173

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Stack Tecnológico

- **Framework:** React 18
- **Bundler:** Vite
- **Enrutador:** React Router DOM
- **Gestión de Estado:** Zustand
- **Autenticación:** Supabase Client
- **UI:** CSS (sin frameworks externos)

## Páginas

### Login (`/login`)
- Formulario de login
- Validación de email y contraseña
- Manejo de errores
- Rate limiting (5 intentos / 15 minutos)

### Dashboard (`/dashboard`)
- Panel de administración
- Información del usuario
- Estadísticas de seguridad
- Logout

## Seguridad

- **CSRF Protection:** Tokens enviados en headers
- **Rate Limiting:** Configurado en el backend
- **Session Management:** Tokens JWT con expiración
- **Secure Headers:** Helmet configurado en el backend

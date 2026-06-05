# Backend Análisis Mercado

Backend Node/Express independiente para la app **Análisis Mercado**.

Objetivo de esta fase: crear el esqueleto mínimo reversible para empezar la migración desde la SPA estática `borrador_valoracion_v5.html` hacia un backend propio que oculte claves y concentre integraciones externas.

## Estructura

```text
backend/
  package.json
  .env.example
  src/
    index.js
    config/
      env.js
    routes/
      README.md
    services/
      README.md
```

## Variables de entorno

Copiar `.env.example` a `.env` en local y completar solo en entornos autorizados:

```text
FMP_API_KEY=
CLAUDE_API_KEY=
PORT=3001
```

No se deben guardar claves reales en git.

## Arranque local

```bash
npm install
npm start
```

Healthcheck:

```bash
curl http://127.0.0.1:3001/api/health
```

Respuesta esperada:

```json
{"status":"ok"}
```

## Plan por fases

1. **Fase 1:** esqueleto Express, healthcheck y documentación de arquitectura.
2. **Fase 2:** mover llamadas FMP al backend y eliminar exposición de `fmpKey` en navegador.
3. **Fase 3:** mover llamadas Claude/Anthropic al backend y eliminar exposición de `claudeKey` en navegador.
4. **Fase 4:** integrar este backend como cuarto servicio aislado dentro de `panel-inteligencialoren`, sin tocar producción hasta autorización explícita.
5. **Fase 5:** añadir módulo de opciones financieras solo lectura.

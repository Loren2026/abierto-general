# Análisis Mercado — Arquitectura actual y plan de migración

## Estado actual

La app actual vive en `borrador_valoracion_v5.html` como SPA estática monolítica de aproximadamente 2834 líneas. Contiene HTML, CSS y JavaScript en un único archivo.

El monolito implementa, entre otras cosas:

- Configuración local de claves.
- Consulta de datos financieros desde Financial Modeling Prep (FMP).
- Cálculos de valoración y datos por empresa.
- Persistencia de datos del usuario en `localStorage`.
- Lectura/análisis de documentos o capturas usando Claude/Anthropic desde el navegador.
- Exportación/importación de datos locales.

## Endpoints FMP detectados

En el archivo actual se detecta una función común:

- `fmpFetch(endpoint, tk, extraParams={})`

Construye URLs con este patrón:

```text
https://financialmodelingprep.com/stable/{endpoint}?symbol={ticker}&apikey={key}
```

Endpoints usados directamente en el monolito:

- `quote`
- `income-statement`
- `balance-sheet-statement`
- `cash-flow-statement`

También se usa `quote` para divisas:

- `EURUSD`
- `GBPUSD`
- `USDCAD`

## Claves expuestas en navegador

Actualmente las claves se guardan y leen desde `localStorage`, por tanto quedan expuestas al navegador y al usuario local:

- `fmpKey`
  - `getFmpKey()` lee `localStorage.getItem('fmpKey')`.
  - `setFmpKey(k)` guarda `localStorage.setItem('fmpKey', k)`.

- `claudeKey`
  - `getClaudeKey()` lee `localStorage.getItem('claudeKey')`.
  - `setClaudeKey(k)` guarda `localStorage.setItem('claudeKey', k)`.

Además, las llamadas a Anthropic se hacen directamente desde navegador contra:

```text
https://api.anthropic.com/v1/messages
```

con cabecera:

```text
anthropic-dangerous-direct-browser-access: true
```

Esto confirma que la clave Claude está diseñada actualmente para uso directo desde browser, que es justo lo que debe eliminarse en la migración.

## Otros datos en localStorage

Además de claves, el monolito usa `localStorage` para datos funcionales:

- `idc7`
- `idc_inputs_{ticker}`
- `fxRates`
- `brokerTariffs`

Estos datos no se migran en Fase 1. Solo quedan documentados.

## Plan de migración recomendado

### Fase 1 — esqueleto backend

Crear backend independiente Node/Express con:

- `GET /api/health`
- carga de `.env`
- documentación
- sin modificar el HTML monolítico

### Fase 2 — proxy FMP server-side

Mover llamadas FMP al backend:

- El navegador pedirá datos a `/api/fmp/...` o rutas equivalentes.
- El backend añadirá `FMP_API_KEY` desde entorno.
- Eliminar `fmpKey` de la UI y del `localStorage` en una fase controlada.

### Fase 3 — proxy Claude/Anthropic server-side

Mover llamadas a Claude al backend:

- El navegador enviará documentos/capturas/prompts a rutas internas.
- El backend llamará a Anthropic con `CLAUDE_API_KEY` desde entorno.
- Eliminar `claudeKey`, `anthropic-dangerous-direct-browser-access` y cualquier llamada directa desde browser.

### Fase 4 — integración como cuarto servicio

Integrar el backend como cuarto servicio aislado dentro de `panel-inteligencialoren`, junto a `api`, `web` y `bridge`, solo con autorización explícita de despliegue.

En esta fase no se toca Docker, Traefik, DNS ni producción.

### Fase 5 — opciones financieras

Añadir módulo de opciones financieras solo lectura:

- cadenas de opciones,
- vencimientos,
- strikes,
- calls/puts,
- IV y griegas,
- análisis/recomendaciones,
- sin ejecución automática de órdenes.

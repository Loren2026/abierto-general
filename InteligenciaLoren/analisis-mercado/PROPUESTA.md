# PROPUESTA — Análisis Mercado fases 3-6 preparadas

Estado: PREPARADO PERO SIN EJECUTAR en lo irreversible.
Rama: `feature/analisis-mercado-fases-3-6-preparadas`.

## Estado final por fase

### Fase 1 — Backend Node/Express

HECHO. Existe backend Express en `backend/src/index.js` con healthcheck y rutas `/api/fmp`, `/api/analysis`, `/api/recommendations` y `/api/options`.

### Fase 2 — Proxy FMP server-side

HECHO. Las llamadas FMP pasan por backend (`backend/src/routes/fmp.js`, `backend/src/services/fmpService.js`) y usan `FMP_API_KEY` desde entorno.

### Fase 3 — Costes/tarifas mantenibles

HECHO para el alcance seguro actual.

- Costes sacados del hardcode de `recommendationService` a `backend/src/config/marketCosts.js`.
- Archivo comentado por mercado y con fuentes documentales internas.
- Si falta mercado/tarifa, el backend devuelve `estado: no_calculado` y motivo claro: no inventa costes.
- Advertencia explícita: no incluye comisión concreta del broker si no está documentada.

Pendiente irreversible/operativo: Loren debe confirmar fuentes y tarifas reales antes de considerarlo asesoramiento fiable.

### Fase 4 — Opciones IBKR

PREPARADA PERO BLOQUEADA.

- Flag `OPTIONS_ENABLED=false` en `.env.example`.
- Rutas preparadas: `GET /api/options/status`, `GET /api/options/chain/:symbol`.
- Servicio preparado en `backend/src/services/optionsService.js`.
- UI muestra estado honesto de opciones desde `/api/options/status`.
- Con el flag apagado, el backend NO llama a IBKR y NO devuelve datos simulados.

Bloqueo real: Loren debe solicitar Nivel 2 en cuenta CASH para compra de calls/puts y coberturas, sin venta descubierta.

### Fase 5 — Recomendaciones

HECHO para robustez backend básica.

- Tests con mock FMP + mock Claude en `backend/test/recommendation.test.js`.
- Tests cubren modo mock explícito, datos vacíos, parseo Claude, rate limit y flujo FMP+Claude mockeado.
- Manejo de errores público en `backend/src/utils/errorResponse.js`:
  - FMP caído / sin datos: mensaje claro.
  - rate limit: mensaje claro.
  - símbolo inexistente o sin quote: mensaje claro.
  - Claude no parseable/no disponible: mensaje claro.
- No se simulan datos salvo `useMock=true` explícito.

### Fase 6 — Despliegue

PREPARADO PERO SIN DESPLEGAR.

- Dockerfile existente revisado.
- `docker-compose.example.yml` preparado con healthcheck.
- `.env.example` actualizado sin secretos reales.
- `DESPLIEGUE_FASE6.md` actualizado con pasos exactos para el host.

## Pasos irreversibles pendientes de Loren con el PC

1. Crear/copiar `backend/.env` real en el host con:
   - `FMP_API_KEY` real.
   - `CLAUDE_API_KEY` real.
   - `CLAUDE_MODEL` confirmado.
   - `OPTIONS_ENABLED=false` hasta permiso IBKR.
2. Revisar con Claude la PR antes de merge.
3. Aprobar merge a `main`.
4. En el host, copiar/actualizar el código y ejecutar build/deploy Docker.
5. Configurar dominio/reverse proxy/TLS si aplica.
6. Probar `/api/health`, `/api/fmp/quote/AAPL`, `/api/recommendations/analyze` y UI desde navegador.
7. Solo cuando IBKR confirme permisos Nivel 2 en cuenta CASH, decidir integración real IBKR y cambiar `OPTIONS_ENABLED=true`. No hacerlo antes.

## Verificación ejecutada

```text
npm test
```

Resultado: 5 tests pass.

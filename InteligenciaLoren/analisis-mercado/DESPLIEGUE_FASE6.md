# Análisis Mercado — DESPLIEGUE FASE 6 (PREPARADO, NO EJECUTADO)

Este documento deja preparado el despliegue del backend de Análisis Mercado. No se ha ejecutado ningún despliegue, no se han usado secretos reales y no se ha tocado producción.

## Estado

- Rama de trabajo: `feature/analisis-mercado-fases-3-6-preparadas`.
- Backend Node/Express preparado.
- Dockerfile existente revisado.
- `docker-compose.example.yml` preparado como plantilla, no aplicado.
- Opciones IBKR bloqueadas por defecto con `OPTIONS_ENABLED=false`.

## Precondiciones antes de tocar host

1. Revisión de Claude aprobada.
2. Autorización explícita de Loren.
3. Confirmar ruta real del repo/stack en el host.
4. Confirmar dominio final del backend.
5. Confirmar configuración Traefik real antes de editar labels. No tocar Traefik sin autorización explícita.
6. Crear `.env` real solo en el host, nunca en git.

## Variables `.env` reales del servidor

Crear `InteligenciaLoren/analisis-mercado/backend/.env` en el host copiando `.env.example` y rellenando allí:

```text
FMP_API_KEY=<valor_real_en_host>
CLAUDE_API_KEY=<valor_real_en_host>
CLAUDE_MODEL=claude-sonnet-4-20250514
PORT=3001
OPTIONS_ENABLED=false
```

No activar `OPTIONS_ENABLED=true` hasta que Loren tenga permisos IBKR Nivel 2 en cuenta CASH y se implemente integración real. No se permiten datos simulados de opciones.

## Docker Compose preparado

Archivo plantilla:

- `docker-compose.example.yml`

Uso previsto en host, si Loren autoriza:

```bash
cd <ruta-real>/InteligenciaLoren/analisis-mercado
cp docker-compose.example.yml docker-compose.yml
cp backend/.env.example backend/.env
nano backend/.env  # rellenar secretos reales SOLO en host
```

Si se integra en un compose mayor con Traefik, adaptar el servicio y labels contra la configuración real del host. No aplicar labels inventadas.

## Comandos previstos (NO EJECUTADOS)

```bash
cd <ruta-real-del-repo>
git fetch origin
git checkout feature/analisis-mercado-fases-3-6-preparadas
git pull --ff-only origin feature/analisis-mercado-fases-3-6-preparadas
cd InteligenciaLoren/analisis-mercado
cp docker-compose.example.yml docker-compose.yml
cp backend/.env.example backend/.env
nano backend/.env

docker compose build analisis-mercado-backend
docker compose up -d analisis-mercado-backend
docker compose ps
docker compose logs --tail=100 analisis-mercado-backend
curl -i http://127.0.0.1:3001/api/health
```

Si el servicio queda detrás de dominio/TLS autorizado:

```bash
curl -i https://<dominio-backend-autorizado>/api/health
```

## Verificaciones post-despliegue previstas

1. `GET /api/health` responde `200 {"status":"ok"}`.
2. `GET /api/options/status` responde `enabled:false` y mensaje de bloqueo por permisos IBKR.
3. `GET /api/fmp/quote/AAPL` responde datos o error claro de proveedor, nunca clave expuesta.
4. `POST /api/recommendations/analyze` con `{"symbol":"AAPL"}` responde recomendación o error claro.
5. Logs sin claves.
6. Frontend apunta a `window.BACKEND_URL` real.
7. CORS revisado/restringido antes de exposición pública definitiva.

## Rollback previsto

```bash
docker compose stop analisis-mercado-backend
docker compose rm -f analisis-mercado-backend
# revertir cambios de compose/Traefik solo si fueron aplicados y autorizados
```

## Irreversible pendiente

- Push/merge a `main`.
- Copiar secretos reales al host.
- Levantar contenedor en producción.
- Cambios Traefik/DNS/TLS.
- Activar opciones con IBKR.

Todo lo anterior queda pendiente de Loren.

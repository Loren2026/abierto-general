# Análisis Mercado — DESPLIEGUE FASE 6 (PLAN, NO EJECUTADO)

Este documento deja preparado el despliegue del backend de Análisis Mercado como cuarto servicio aislado dentro de `panel-inteligencialoren`, junto a `api`, `web` y `bridge`.

**Estado:** plan pendiente de autorización explícita de Loren. No se ha ejecutado ningún despliegue.

## Precondiciones

- Rama revisada: `feature/analisis-backend`.
- Backend local probado.
- Claves reales disponibles solo en el servidor/VPS y nunca en git:
  - `FMP_API_KEY`
  - `CLAUDE_API_KEY`
  - `CLAUDE_MODEL` opcional
  - `PORT=3001`
- Confirmar URL final autorizada para frontend/backend antes de tocar producción.

## Archivos preparados en Fase 5

- `analisis-mercado/backend/Dockerfile`
- Frontend conectado a backend mediante `window.BACKEND_URL` con valor local por defecto.

## Cambio previsto en docker-compose (NO APLICADO)

Añadir un cuarto servicio similar a:

```yaml
analisis-backend:
  build:
    context: ./analisis-mercado/backend
  environment:
    - PORT=3001
    - FMP_API_KEY=${FMP_API_KEY}
    - CLAUDE_API_KEY=${CLAUDE_API_KEY}
    - CLAUDE_MODEL=${CLAUDE_MODEL}
  networks:
    - traefik
  labels:
    - traefik.enable=true
    - traefik.http.routers.analisis-backend.rule=Host(`analisis.inteligencialoren.com`)
    - traefik.http.routers.analisis-backend.entrypoints=websecure
    - traefik.http.routers.analisis-backend.tls.certresolver=letsencrypt
    - traefik.http.services.analisis-backend.loadbalancer.server.port=3001
```

La red, nombres de entrypoints y certresolver deben verificarse contra el compose real antes de aplicar nada.

## Variables .env del servidor

Añadir en el `.env` real del servicio/stack, nunca en git:

```text
FMP_API_KEY=<valor_real_en_servidor>
CLAUDE_API_KEY=<valor_real_en_servidor>
CLAUDE_MODEL=claude-sonnet-4-20250514
PORT=3001
```

## Orden exacto de comandos previsto

> Estos comandos son plan, no ejecución. Ejecutarlos solo tras autorización explícita de Loren y desde el host correcto.

```bash
cd <ruta-real-panel-inteligencialoren>
git fetch origin
git checkout feature/analisis-backend
git pull --ff-only origin feature/analisis-backend
# editar docker-compose con el nuevo servicio y labels Traefik autorizadas
# editar .env real del servidor con claves reales
# build/recreate solo del servicio nuevo si compose lo permite
docker compose build analisis-backend
docker compose up -d analisis-backend
docker compose logs -f analisis-backend
curl -i https://analisis.inteligencialoren.com/api/health
```

## Verificaciones post-despliegue previstas

1. `GET /api/health` responde `200 {"status":"ok"}`.
2. `POST /api/recommendations/analyze` responde controladamente.
3. El HTML no contiene llamadas directas a FMP/Claude ni claves en navegador.
4. Logs sin claves.
5. CORS restringido al dominio real cuando se cierre la configuración de producción.

## Rollback previsto

Si falla:

```bash
docker compose stop analisis-backend
# revertir cambio de compose si se aplicó en commit separado
# mantener api/web/bridge sin tocar
```

No tocar Traefik/DNS/producción sin autorización expresa.

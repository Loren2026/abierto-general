# Arranque local — Restricciones Tráfico PWA

## Estado

Rama: `feature/restricciones-fase4-rutas`

La app sirve backend + frontend desde el mismo FastAPI. No hay dominio ni deploy en esta fase.

## 1. Entrar en backend

```bash
cd /ruta/al/repo/restricciones-trafico/backend
```

## 2. Crear/activar entorno Python e instalar dependencias

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt` fija:

- `fastapi==0.115.6`
- `uvicorn[standard]==0.34.0`
- `pydantic==2.10.4`

El resto del backend usa librería estándar de Python (`sqlite3`, `urllib`, `json`, etc.).

## 3. Arrancar Uvicorn

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

## 4. Abrir en navegador

Desde el propio host:

```txt
http://127.0.0.1:8090/
```

Desde otro equipo/móvil en la red, sustituyendo por la IP del host:

```txt
http://IP_DEL_HOST:8090/
```

La pantalla principal se sirve en `/` porque FastAPI monta los estáticos de `restricciones-trafico/frontend/` en la raíz.

Endpoint usado por la PWA:

```txt
POST /api/ruta/analizar
```

El frontend usa URL relativa:

```js
fetch('/api/ruta/analizar', ...)
```

Por tanto funciona en local con el mismo origen/puerto y no requiere CORS.

## Healthcheck

```bash
curl http://127.0.0.1:8090/health
```

Esperado:

```json
{"status":"ok","total_restricciones":381}
```

## Avisos de uso

- El análisis llama a Nominatim, OSRM y Overpass públicos.
- Puede tardar entre 10 y 60 segundos según ruta/carga de Overpass.
- Overpass puede devolver 504/rate limit; la pantalla mostrará error legible o avisos.
- Si la detección de vías es incompleta, la app muestra: `No se puede garantizar vía libre, revisar manualmente`.
- No se debe interpretar como “vía libre” salvo confianza alta y revisión del detalle.

## Fronteras no cruzadas

No se ha hecho:

- deploy producción,
- DNS,
- Traefik,
- docker-compose producción,
- merge a main,
- servicios de pago.

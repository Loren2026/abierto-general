# Fase 5 — Frontend/PWA Restricciones Tráfico

## Rama

- `feature/restricciones-fase4-rutas`
- Continúa desde Fase 4 porque el frontend consume directamente el endpoint local añadido allí.

## Implementación

Se añade una PWA estática móvil primero en:

- `frontend/index.html`
- `frontend/styles.css`
- `frontend/app.js`
- `frontend/manifest.webmanifest`
- `frontend/service-worker.js`
- `frontend/icon.svg`

Se monta desde FastAPI si existe la carpeta frontend:

- `backend/app/main.py`

```python
FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
...
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
```

## Pantalla principal

Campos:

- Origen
- Destino
- Fecha salida
- Fecha llegada
- Botón `Analizar ruta`

Llama a:

```txt
POST /api/ruta/analizar
```

## Resultado móvil

Muestra:

- Nivel de confianza (`alta`, `media`, `baja`) con color visual.
- Aviso obligatorio si confianza no es alta: `No se puede garantizar vía libre, revisar manualmente.`
- Mapa Leaflet + tiles OpenStreetMap.
- Trazado de ruta usando `geometry.coordinates` de GeoJSON.
- Lista de restricciones: vía, fechas, ámbito DGT/País Vasco, tramo, PK, sentido, tipo.
- Vías detectadas en chips.
- Estados de carga/error legibles.

## Mapa

Librería:

- Leaflet desde CDN.
- Tiles OpenStreetMap gratis.
- Sin Google Maps.

Limitación actual: las restricciones se marcan como puntos aproximados sobre la ruta porque la BD no contiene geometría/PK geocodificado por restricción. Para tramo real habría que geocodificar PK o disponer de geometría de tramos.

## PWA

Incluye:

- `manifest.webmanifest`
- `service-worker.js`
- icono SVG
- `display: standalone`

El service worker cachea assets estáticos y deja pasar `/api/*` a red.

## Verificación local disponible

Este contenedor no tiene instalados `fastapi` ni `uvicorn`, así que no se pudo levantar servidor local aquí:

```txt
fastapi missing No module named 'fastapi'
/usr/bin/python3: No module named uvicorn
```

Sí se verificó:

```txt
python3 -m py_compile app/main.py app/osm_enrichment.py app/routing.py app/route_analysis.py
python3 -m unittest tests.test_route_analysis -v
```

Resultado tras ajustar tests para no llamar Overpass con proveedor fake:

```txt
Ran 3 tests ... OK
```

Assets creados y presentes:

- `frontend/index.html`
- `frontend/styles.css`
- `frontend/app.js`
- `frontend/manifest.webmanifest`
- `frontend/service-worker.js`
- `frontend/icon.svg`

## Fronteras no cruzadas

No se ha hecho:

- Deploy.
- DNS.
- Traefik.
- Alta docker-compose.
- Merge a main.
- Servicios de pago.

# PR preparado — Restricciones tráfico ORS/RIMP 2026

## Resumen

- Routing alternativo con OpenRouteService (`driving-hgv`) en backend, clave solo por entorno.
- Endpoint paralelo `POST /api/ruta/alternativa`; el endpoint clásico `/api/ruta/analizar` se conserva.
- Cálculo de km y ETA a velocidad fija de 78 km/h desde hora manual de salida.
- Scoring inicial de categoría de vía: autopista > autovía > nacional > resto, penalizando comarcales/locales.
- UI: hora manual, selector General/ADR, mapa Leaflet con capas, leyenda, botón centrar, panel km/ETA y fallback al flujo clásico.
- Geometrías prioritarias OSM/PK y `avoid_polygons_high_confidence.geojson`.
- SQL ya preparado/ajustado para `restriction_geometries`, `rimp_segments`, `route_calculations` con RLS.
- RIMP 2026 patrón oro validado por Claude a 0 errores y loader Supabase preparado.

## Validación local requerida antes de merge

```bash
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover -s backend/tests -v
node --check frontend/app.js
```

## Merge

PREPARADO PERO SIN EJECUTAR: mergear `feature/restricciones-routing-ors-propuesta` a `main` solo con autorización de Loren.

# Fase 4 — cálculo de ruta + cruce con restricciones

## Rama/base

- Rama: `feature/restricciones-fase4-rutas`
- Base workspace: `5baf0257307c2fe59e3310ce105f6791dad57ebb`

## Proveedor de routing

Se añade capa intercambiable en:

- `backend/app/routing.py`

Proveedor inicial gratuito:

- Nominatim público para geocoding.
- OSRM público (`https://router.project-osrm.org`) para ruta.

No requiere clave ni tarjeta. Limitación: puede tener límites de uso/ disponibilidad; si falla, se puede sustituir por otro proveedor implementando la misma interfaz `RoutingProvider`.

## Endpoint nuevo

- `POST /api/ruta/analizar`
- Implementado en `backend/app/main.py`.

Payload:

```json
{
  "origen": "Oviedo",
  "destino": "Madrid",
  "fecha_salida": "2026-08-15",
  "fecha_llegada": "2026-08-15"
}
```

Respuesta principal:

```json
{
  "provider": "osrm-public",
  "origen": {},
  "destino": {},
  "vias_detectadas": ["A-6", "AP-6"],
  "route_confidence": "alta|baja",
  "warnings": [],
  "geometry": {},
  "restricciones": [],
  "summary": {
    "total_vias": 0,
    "total_restricciones": 0,
    "no_declarar_via_libre": false
  }
}
```

## Cruce vía ↔ restricción

Código:

- `backend/app/route_analysis.py`

Lógica:

1. El proveedor de ruta devuelve geometría y nombres de steps.
2. `routing.extract_road_codes()` extrae códigos tipo `A-3`, `AP-7`, `N-340`.
3. Se normalizan códigos con `normalize_road_code()`.
4. Se consultan restricciones SQLite por `road_normalized`.
5. Se filtra por ventana de fechas usando la lógica ya existente de Fase 3 (`affected_days`).
6. Se excluye `aplica_solo_transfronterizo=1`.
7. Se devuelve `confidence`:
   - `alta` si ruta y restricción tienen alta confianza.
   - `media` si hay mezcla de señales.
   - `baja` si la ruta no aporta vías suficientes o match genérico.

Regla de seguridad: si `route_confidence = baja`, `summary.no_declarar_via_libre = true`. Nunca debe comunicarse “vía libre” con confianza baja.

## Tests locales

Tests sin proveedor externo, usando `FakeProvider` para no depender de límites OSRM/Nominatim:

- `backend/tests/test_route_analysis.py`

Rutas verificadas:

- Asturias → Madrid: vías fake `A-66`, `AP-66`, `A-6`, `AP-6`; detecta restricciones en `A-6`/`AP-6`.
- Asturias → Levante: vías fake `A-66`, `A-6`, `M-50`, `A-3`; detecta restricciones en `A-3`.
- País Vasco: vías fake `A-8`, `AP-8`, `N-240`; detecta restricciones `PAIS_VASCO`.

Salida real:

```txt
Ran 3 tests in 0.004s
OK
```

## Incidencia de datos detectada

El contexto indicaba que el tráiler de Loren, 5 ejes, tendría 4 tramos País Vasco con `aplica_a_loren=true`.

Pero la SQLite actual verificada devuelve:

```txt
aplica_a_loren counts [('DGT', None, 325), ('DGT', 1, 4), ('PAIS_VASCO', None, 52)]
```

Es decir: en la BD actual, los 4 registros `aplica_a_loren=1` están en `DGT`, no en `PAIS_VASCO`. No se corrige en Fase 4 porque sería una modificación de datos/fase anterior; queda como incidencia a revisar.

## Limitaciones

- OSRM público no siempre devuelve nombres/códigos de carretera suficientes en todos los steps.
- No hay matching geométrico PK/rango todavía; el cruce actual es por código de vía y fecha.
- Restricciones genéricas sin vía concreta: la BD actual no mostró `G-*`; el código deja estructura para `generic_scope` si aparecen.
- No se ha desplegado nada.
- No se han usado servicios de pago.

## Prueba real OSRM + Overpass — 2026-06-05

### GraphHopper

Prueba sin API key:

```txt
HTTP 401 Unauthorized
{"message":"No API key specified. Please register and see documentation: https://www.graphhopper.com/developers/"}
```

Conclusión: GraphHopper puede ser alternativa, pero requiere API key gratuita. No se registró ninguna clave.

### OSRM solo

OSRM público devolvía geometría, pero en rutas largas desde Lugones solo entregaba refs locales (`AS-381`, `AS-17`) y omitía vías principales como `A-66`, `A-6`, `A-3`. Eso no es aceptable como única fuente.

### OSRM + Overpass sobre geometría

Se añadió enriquecimiento en:

- `backend/app/osm_enrichment.py`
- `backend/app/route_analysis.py`

La geometría OSRM se muestrea y se consulta Overpass para vías OSM cercanas con tag `ref`. Se usan endpoints gratuitos con fallback:

- `https://overpass-api.de/api/interpreter`
- `https://overpass.kumi.systems/api/interpreter`

Primera prueba real tuvo `504 Gateway Timeout` en alguna ruta. Tras reducir muestreo y añadir fallback, las tres rutas funcionaron.

Fecha usada: `2026-08-15`.

#### Lugones → Madrid

Vías detectadas:

```txt
AS-381, AS-17, A-6, AP-6, A-66, AP-66, A-63, A-62, O-12, N-630
```

Restricciones detectadas: 6.

```txt
dgt-2026-f-0124 | A-6  | 2026-08-15 | alta
dgt-2026-g-0028 | A-6  | 2026-08-15 | alta
dgt-2026-g-0030 | A-6  | 2026-08-15 | alta
dgt-2026-f-0131 | A-62 | 2026-08-15 | alta
dgt-2026-g-0029 | AP-6 | 2026-08-15 | alta
dgt-2026-g-0040 | N-630 | 2026-08-15 | alta
```

#### Lugones → Valencia

Vías detectadas:

```txt
AS-381, AS-17, AP-66, A-66, A-6, A-3, AP-6
```

Restricciones detectadas: 6.

```txt
dgt-2026-f-0126 | A-3  | 2026-08-15 | alta
dgt-2026-g-0026 | A-3  | 2026-08-15 | alta
dgt-2026-f-0124 | A-6  | 2026-08-15 | alta
dgt-2026-g-0028 | A-6  | 2026-08-15 | alta
dgt-2026-g-0030 | A-6  | 2026-08-15 | alta
dgt-2026-g-0029 | AP-6 | 2026-08-15 | alta
```

#### Lugones → Bilbao

Vías detectadas:

```txt
AS-381, AS-17, A-8, A-64, N-632, N-634
```

Restricciones detectadas: 4.

```txt
dgt-2026-g-0012 | A-8 | 2026-08-15 | alta
dgt-2026-g-0013 | A-8 | 2026-08-15 | alta
pv-2026-0001    | A-8 | 2026-08-15 | alta
pv-2026-0004    | A-8 | 2026-08-15 | alta
```

### Conclusión proveedor

Proveedor ganador para Fase 4 reversible: **OSRM + Overpass**.

- OSRM aporta ruta/geometría gratis sin clave.
- Overpass aporta `ref` reales de carreteras sobre la geometría.
- Si Overpass falla, el sistema lo registra en `warnings`; si quedan pocas vías, baja la confianza y no permite declarar “vía libre”.

Limitación: Overpass público puede devolver 504/rate limit. Para producción habría que valorar caché local, throttling fuerte o instancia propia/servicio estable.

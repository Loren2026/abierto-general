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

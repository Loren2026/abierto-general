# PROPUESTA — ORS avoid_polygons para alternativas reales

## Objetivo
Conectar las 9 geometrías de restricciones de confianza alta guardadas en Supabase al endpoint `POST /api/ruta/alternativa`, construyendo `options.avoid_polygons` para OpenRouteService `driving-hgv`, de forma que la alternativa sea una ruta real evitando restricciones y no una segunda candidata genérica.

## 1. Lectura de `restriction_geometries` desde Supabase

- El backend leerá desde `public.restriction_geometries` usando `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- La consulta REST será de solo lectura y filtrará `confidence=eq.alta`.
- En esta fase se limita explícitamente a las geometrías de confianza alta esperadas por Loren: 9 registros.
- Se usará preferentemente `buffer_geojson` si existe, porque ORS necesita polígonos/ multipolígonos para `avoid_polygons`; si no existe, se descartará honestamente la geometría y se devolverá aviso técnico.
- Turín no tiene claves de Supabase en su contenedor: las pruebas reales quedan preparadas para ejecutar desde el host con `.env` real.

## 2. Construcción de `avoid_polygons` para ORS

- ORS acepta `options.avoid_polygons` como GeoJSON `Polygon` o `MultiPolygon` en el endpoint `/v2/directions/driving-hgv/geojson`.
- Límite documentado de ORS para avoid polygons: área total máxima aproximada de 200 km² y extensión máxima de 20 km en alto o ancho.
- Implementación:
  - Parsear cada `buffer_geojson`.
  - Aceptar `Polygon` y `MultiPolygon`.
  - Construir un único `MultiPolygon`.
  - Medir extensión aproximada por bounding box en km.
  - Si se supera el límite de extensión, simplificar de forma conservadora usando un bounding box reducido alrededor del centroide, con aviso.
  - Si se supera el presupuesto de área aproximada, incluir primero las geometrías válidas hasta el límite y devolver aviso en `warnings` / `alternative_status`.

## 3. Estrategia de respuesta

- Se solicitarán dos rutas ORS:
  1. Ruta original sin `avoid_polygons`.
  2. Ruta alternativa con `avoid_polygons`.
- La respuesta mantiene `original_route` con distancia y ETA calculada a 78 km/h.
- `alternative_route` solo aparece si ORS encuentra ruta evitando polígonos.
- Criterio vinculante de Loren:
  - Prioridad absoluta a mejor categoría de vía.
  - Nunca seleccionar comarcales/locales si existe ruta por autopista/autovía/nacional.
  - ETA siempre calculada a 78 km/h desde la hora manual de salida.

## 4. Caché vs lectura por petición

- Opción elegida: lectura por petición con caché corto en memoria, TTL 300 segundos.
- Justificación: reduce llamadas a Supabase sin congelar datos; ante actualización urgente el desfase máximo esperado es de 5 minutos.
- Si faltan credenciales de Supabase, el endpoint no inventa alternativas: devuelve `alternative_status` indicando que no se aplicaron `avoid_polygons` por configuración ausente.

## 5. Manejo honesto de errores

- Si ORS no encuentra ruta con `avoid_polygons`, se devuelve `alternative_status.found=false` con motivo concreto.
- No hay fallback mudo al análisis clásico dentro de `/api/ruta/alternativa`.
- Motivos explícitos contemplados: Supabase no configurado, no hay geometrías válidas, ORS rechazó polígonos, ORS no encontró ruta alternativa.

## 6. Fecha/vigencia

- En esta fase no se filtra por fecha/vigencia porque `restriction_geometries` no contiene campos de ventana temporal de restricción; almacena geometrías priorizadas.
- El filtrado temporal queda preparado para una fase posterior enlazando `restriction_id` con la fuente canónica de restricciones vigentes.

## 7. Tests

- Tests con mock de Supabase: 9 geometrías alta, construcción de `MultiPolygon`, y estado honesto sin datos/configuración.
- Tests con mock de ORS: dos llamadas — original sin avoid y alternativa con avoid —, verificación de `avoid_polygons`, y fallo ORS con conservación de ruta original + motivo concreto.

## Límite irreversible

- Permitido en esta rama: código, tests, commit y push.
- PREPARADO PERO SIN EJECUTAR: merge a `main`, despliegue en producción, ejecución real contra Supabase/ORS con claves del host.

---

# PROPUESTA.md — App Restricciones Tráfico 2026

## 0. Objetivo

Crear una app dentro de `panel-inteligencialoren` para que Loren consulte, antes de un viaje, si un camión de mercancías en general de más de 7.500 kg de MMA encontrará restricciones de circulación en su trayecto y ventana temporal.

Alcance funcional decidido:

- Vehículos: **mercancías en general >7.500 kg MMA**.
- Excluido: ADR, vehículos especiales, transportes especiales y otras categorías.
- DGT + País Vasco: herramienta principal unificada.
- Cataluña: pestaña independiente, por formato distinto y uso esporádico.
- Consulta por origen, destino, fecha/hora salida y fecha/hora llegada.
- Versión ambiciosa: cálculo de ruta, mapa, detección de vías, cruce con restricciones, edición manual de vías/rutas alternativas.

Fuentes ya descargadas:

- `fuentes-2026/dgt-boe-a-2026-1255.pdf`
- `fuentes-2026/pais-vasco-euskadi-7500kg-es-26.pdf`
- `fuentes-2026/pais-vasco-boe-a-2026-2625.pdf`
- `fuentes-2026/cataluna-isp-300-2026.pdf`

Pendiente incorporar en extracción DGT:

- Corrección de errores BOE-A-2026-4377, de 19/02.
- Corrección de errores BOE-A-2026-7127, de 23/03.

## 1. Diseño de datos: extracción PDF → base estructurada

### 1.1. Principio general

No conviene que la app consulte el PDF en tiempo real. El PDF debe convertirse en una base de datos estructurada, revisable y trazable.

Flujo propuesto:

1. Descargar fuentes oficiales.
2. Extraer tablas/texto.
3. Convertir a registros normalizados.
4. Validar manualmente muestras críticas.
5. Guardar cada registro con referencia exacta a fuente, anexo, página y fila original.
6. Publicar la BD procesada para consulta del backend.

### 1.2. Modelo común DGT + País Vasco

Tabla/colección `restrictions`:

```json
{
  "id": "dgt-2026-anexo-ii-0001",
  "source_scope": "DGT|PAIS_VASCO",
  "source_file": "dgt-boe-a-2026-1255.pdf",
  "source_title": "Resolución...",
  "source_annex": "ANEXO II",
  "source_page": 12,
  "source_row_raw": "texto original de la fila",

  "vehicle_type": "mercancias_general_gt_7500kg",
  "restriction_type": "periodica|fecha_concreta|permanente|correccion",

  "road": "A-1",
  "road_normalized": "A-1",
  "pk_start": 12.5,
  "pk_end": 45.0,
  "town_start": "...",
  "town_end": "...",
  "direction": "ambos|creciente|decreciente|sentido_texto_original",
  "direction_raw": "sentido literal del PDF",

  "date_rule": {
    "kind": "date_list|weekday_range|periodic_pattern|permanent|relative_holiday",
    "dates": ["2026-03-27"],
    "from": "2026-01-01",
    "to": "2026-03-31",
    "weekdays": ["friday"],
    "raw": "todos los viernes de enero a marzo"
  },

  "time_windows": [
    { "start": "15:00", "end": "22:00" }
  ],

  "applies_from": "2026-01-01",
  "applies_to": "2026-12-31",
  "status": "vigente|corregida|anulada",
  "correction_refs": ["BOE-A-2026-4377"],

  "confidence": "alta|media|baja",
  "needs_manual_review": false,
  "notes": ""
}
```

### 1.3. Tipos DGT a tratar

#### A) Restricciones genéricas periódicas

Ejemplo conceptual: “todos los viernes de enero a marzo, de X a Y”.

Tratamiento:

- Guardar como regla, no como texto libre.
- Generar internamente las fechas afectadas para consultas.
- Mantener también el texto original.

Modelo:

```json
"restriction_type": "periodica",
"date_rule": {
  "kind": "periodic_pattern",
  "from": "2026-01-01",
  "to": "2026-03-31",
  "weekdays": ["friday"],
  "raw": "todos los viernes de enero a marzo"
}
```

#### B) Restricciones por fechas concretas

Ejemplo conceptual: Semana Santa, puentes, operación salida/retorno.

Tratamiento:

- Expandir a fechas concretas cuando el PDF las liste expresamente.
- Si son fechas relativas o redactadas como operación especial, resolverlas a fechas 2026 durante la importación.
- Marcar `needs_manual_review=true` cuando la conversión dependa de interpretación.

Modelo:

```json
"restriction_type": "fecha_concreta",
"date_rule": {
  "kind": "date_list",
  "dates": ["2026-04-01", "2026-04-02"],
  "raw": "texto fuente"
}
```

#### C) Restricciones permanentes / alta siniestralidad

DGT menciona Anexo VII como tramos permanentes de alta siniestralidad.

Tratamiento:

- Guardar como `permanente`.
- Vigencia: todo 2026, salvo que el texto indique otro rango.
- En consultas, siempre aplica si ruta y sentido coinciden, dentro de 2026.

Modelo:

```json
"restriction_type": "permanente",
"date_rule": {
  "kind": "permanent",
  "from": "2026-01-01",
  "to": "2026-12-31"
}
```

### 1.4. Correcciones de errores DGT

Las correcciones no deben añadirse como un PDF más sin lógica. Deben aplicarse sobre la base estructurada.

Propuesta:

- Tabla `source_documents` con documentos base y correcciones.
- Tabla `restriction_corrections`:

```json
{
  "id": "boe-a-2026-4377-corr-001",
  "source": "BOE-A-2026-4377",
  "target_source": "BOE-A-2026-1255",
  "action": "replace|delete|add|amend",
  "target_match": {
    "annex": "ANEXO II",
    "road": "A-...",
    "raw_contains": "texto original"
  },
  "new_values": {},
  "needs_manual_review": true
}
```

Criterio:

- Si la corrección permite match inequívoco, se aplica automáticamente.
- Si no, se marca revisión manual.
- La app final debe mostrar siempre la fuente vigente resultante, no registros obsoletos.

### 1.5. Cataluña como pestaña independiente

Cataluña usa formato distinto y tiene buscador oficial propio. No recomiendo forzarla al modelo común en Fase 1.

Propuesta para pestaña Cataluña:

- Mostrar resumen documental de la Resolució ISP/300/2026.
- Enlazar al buscador oficial del Servei Català de Trànsit.
- Más adelante, si Loren lo necesita, hacer parser específico catalán.

Datos mínimos Cataluña:

```json
{
  "source_scope": "CATALUNA",
  "title": "Resolució ISP/300/2026...",
  "dogc_url": "https://dogc.gencat.cat/ca/document-del-dogc/?documentId=1036479",
  "official_search_url": "https://transit.gencat.cat/ca/informacio-viaria/professionals-transport/mesures-especials/consulta-restriccions/",
  "valid_until": "2026-12-31"
}
```

## 2. Motor de ruta y cruce ruta × restricciones × ventana temporal

### 2.1. Entrada del usuario

Formulario principal:

- Origen: texto/lugar.
- Destino: texto/lugar.
- Fecha/hora de salida.
- Fecha/hora estimada de llegada.
- Tipo vehículo fijo: mercancías general >7.500 kg.
- Opcional: evitar autopistas/peajes, preferir ruta rápida/corta.

La ventana temporal se evalúa completa:

```text
[start_datetime, end_datetime]
```

No basta consultar el día de salida.

### 2.2. Cálculo de ruta

El motor debe devolver:

- Geometría del trazado.
- Lista de segmentos/vías.
- Si es posible, PK aproximado de entrada/salida en cada vía.
- Sentido de circulación por tramo.
- Alternativas de ruta.

Problema central: las restricciones están por carretera + PK + sentido, mientras que los motores de ruta devuelven geometría. Hay que mapear geometría a vía/PK.

### 2.3. Cruce con restricciones

Algoritmo conceptual:

1. Geocodificar origen/destino.
2. Calcular 1-N rutas candidatas.
3. Extraer segmentos de vía de cada ruta.
4. Normalizar nombres de vía: `AP-7`, `A-7`, `N-340`, etc.
5. Estimar PK inicio/fin del tramo recorrido.
6. Expandir reglas de fecha para la ventana del viaje.
7. Filtrar restricciones por:
   - ámbito: DGT/País Vasco,
   - vía,
   - intersección PK,
   - sentido compatible,
   - fecha dentro de ventana,
   - franja horaria compatible.
8. Devolver resultado:
   - sin restricciones detectadas,
   - restricciones posibles con confianza media/baja,
   - restricciones confirmadas.

### 2.4. Manejo de incertidumbre

No todo cruce será perfecto. Debe mostrarse una confianza:

- Alta: vía + PK + sentido + fecha/hora coinciden.
- Media: vía + fecha/hora coinciden, pero PK/sentido no se puede confirmar bien.
- Baja: coincidencia por vía o zona, requiere revisión manual.

Nunca conviene afirmar “puedes circular seguro” si hay baja confianza. Mejor:

```text
No detecto restricciones con los datos estructurados, pero revisa fuente oficial si el viaje es crítico.
```

### 2.5. Mapa y edición de vías alternativas

UI propuesta:

- Mapa con ruta principal.
- Panel lateral con vías detectadas:
  - carretera,
  - tramo aproximado,
  - sentido,
  - restricciones encontradas.
- Botón “añadir vía manualmente”.
- Botón “quitar vía”.
- Botón “recalcular con ruta alternativa”.
- Selector de ruta alternativa si el proveedor devuelve varias.

La edición manual es importante porque el motor puede confundir nombres de vía o seleccionar una alternativa que Loren no usará.

## 3. Opciones de mapas/rutas

Decisión de Loren: **no usar soluciones de pago**. Por tanto, se descartan Google Maps Platform y otros proveedores comerciales de pago como opción base.

El diseño debe apoyarse en mapa y enrutado libres/sin coste, dejando igualmente el proveedor como pieza intercambiable para no acoplar la app.

### 3.1. OpenStreetMap + OSRM

Componentes:

- Frontend mapa: Leaflet + tiles OSM.
- Routing: OSRM público o instancia propia.
- Geocoding: Nominatim público o instancia/servicio externo.

Pros:

- Ecosistema libre.
- Sin dependencia directa de Google.
- Leaflet es sencillo y robusto.
- Coste bajo si se usa con poco tráfico y servicios públicos con respeto.

Contras:

- Servicios públicos tienen límites y no deben abusarse.
- OSRM no resuelve bien restricciones específicas de camiones por defecto.
- Montar instancia propia europea consume recursos.
- Geocoding con Nominatim público tiene política de uso estricta.
- El mapeo a PK sigue siendo difícil.

Coste:

- Bajo si uso personal y servicios públicos aceptan volumen.
- Medio/alto si se monta routing propio con datos de Europa.

### 3.2. OpenStreetMap + GraphHopper

Componentes:

- Leaflet/MapLibre en frontend.
- GraphHopper Directions API o instancia propia.

Pros:

- Mejor preparado que OSRM para perfiles y routing más flexible.
- Tiene modalidad cloud con API.
- Puede soportar perfiles de vehículos mejor que soluciones básicas.

Contras:

- Cloud puede ser de pago.
- Instancia propia también requiere mantenimiento.
- Hay que validar si el perfil HGV disponible cubre necesidades reales.
- PK no viene resuelto directamente.

Coste:

- Depende de plan y volumen. No verificado en esta fase.

### 3.3. Rutas habituales guardadas

Dato funcional clave: aproximadamente el 80% de los viajes de Loren son rutas repetidas.

Por eso, la app no debe depender siempre del cálculo automático. Debe permitir guardar **rutas habituales/favoritas** con las vías ya fijadas y revisadas manualmente.

Modelo propuesto `saved_routes`:

```json
{
  "id": "ruta-madrid-bilbao-a1-ap1",
  "name": "Madrid → Bilbao habitual",
  "origin_label": "Madrid",
  "destination_label": "Bilbao",
  "roads": [
    { "road": "A-1", "pk_start": null, "pk_end": null, "direction": "sentido_destino", "manual": true },
    { "road": "AP-1", "pk_start": null, "pk_end": null, "direction": "sentido_destino", "manual": true }
  ],
  "geometry": null,
  "notes": "Vías confirmadas por Loren",
  "updated_at": "2026-06-04"
}
```

Flujo para rutas habituales:

1. Loren elige una ruta guardada.
2. Introduce fecha/hora de salida y llegada.
3. La app cruza directamente `roads × restrictions × ventana temporal`.
4. No llama al motor de rutas, salvo que Loren pida recalcular.

Ventajas:

- Cero coste para el 80% de casos.
- Más fiable que una ruta automática si Loren ya conoce sus vías reales.
- Reduce dependencia de APIs externas.
- Permite corregir manualmente errores de routing una sola vez y reutilizarlos.

Para viajes nuevos, el motor automático queda como ayuda inicial: calcula ruta, propone vías, Loren revisa/edita y opcionalmente guarda como nueva ruta habitual.

### 3.4. Recomendación técnica

Diseñar una interfaz interna intercambiable:

```ts
RouteProvider {
  geocode(place): Coordinates
  calculateRoutes(origin, destination, options): Route[]
}
```

Implementación inicial recomendada:

- **Fase MVP:** OpenStreetMap + Leaflet para mapa, y rutas habituales guardadas como flujo principal.
- **Para viajes nuevos:** OSRM público solo si el uso respeta sus límites, o GraphHopper/OSRM self-host si se necesita estabilidad sin coste por uso.
- **Sin Google Maps de pago** por decisión de Loren.
- Mantener el proveedor como pieza reemplazable desde el día uno.

La app no debe quedar acoplada a un proveedor concreto.

## 4. Arquitectura dentro de panel-inteligencialoren

### 4.1. Estructura propuesta

Nuevo proyecto dentro del repo/panel, similar a Análisis Mercado:

```text
restricciones-trafico/
  backend/
    src/
      index.js
      routes/
      services/
      config/
      importers/
      data/
    package.json
    Dockerfile
    .env.example
  frontend/
    index.html / app
  data/
    fuentes-2026/
    processed/
  docs/
    PROPUESTA.md
    FUENTES.md
    DESPLIEGUE.md
```

Si el panel ya exige otra estructura, adaptar sin tocar servicios existentes.

### 4.2. Backend

Responsabilidades:

- Servir API de consulta.
- Consultar BD estructurada de restricciones.
- Gestionar rutas habituales guardadas.
- Geocodificar/calcular rutas mediante proveedor libre/intercambiable solo para viajes nuevos.
- Cruzar ruta × fechas × restricciones.
- No exponer claves de mapa/routing si el proveedor las requiere.

Endpoints propuestos:

```text
GET  /api/health
GET  /api/sources
GET  /api/saved-routes
POST /api/saved-routes
POST /api/routes/preview
POST /api/restrictions/check
GET  /api/cataluna/info
```

Ejemplo `POST /api/restrictions/check`:

```json
{
  "origin": "Madrid",
  "destination": "Bilbao",
  "departure": "2026-03-27T16:00:00+01:00",
  "arrival": "2026-03-28T09:00:00+01:00",
  "vehicleType": "mercancias_general_gt_7500kg",
  "routeProvider": "graphhopper",
  "manualRoads": ["A-1", "AP-1"]
}
```

Respuesta:

```json
{
  "status": "ok",
  "route": {},
  "window": {},
  "matches": [
    {
      "road": "A-1",
      "pk_start": 10,
      "pk_end": 50,
      "date": "2026-03-27",
      "time_window": "15:00-22:00",
      "confidence": "media",
      "source": "BOE-A-2026-1255 ANEXO II"
    }
  ],
  "warnings": []
}
```

### 4.3. Base de datos

Para empezar, dos opciones:

#### Opción simple: SQLite

Pros:

- Perfecta para app pequeña.
- Archivo único versionable o montable.
- Consultas rápidas.
- Fácil backup.

Contras:

- Menos cómoda si luego hay edición colaborativa o muchos procesos.

#### Opción JSON procesado

Pros:

- Muy simple.
- Fácil revisión en git.
- Suficiente para MVP.

Contras:

- Peor para consultas complejas, solapamientos PK/fechas y auditoría.

Recomendación:

- MVP con JSON procesado + validaciones.
- Pasar a SQLite si el volumen/consultas crecen.

### 4.4. Frontend

Pestañas:

1. **Consulta principal DGT + País Vasco**
   - Origen/destino.
   - Fecha/hora salida/llegada.
   - Mapa.
   - Vías detectadas/editables.
   - Resultado restricciones.

2. **Cataluña**
   - Información de la Resolució ISP/300/2026.
   - Enlace al buscador oficial.
   - Nota clara: Cataluña no está integrada aún en el motor principal.

3. **Fuentes**
   - Documentos oficiales usados.
   - Fecha de importación.
   - Correcciones aplicadas.

4. **Configuración técnica**
   - Proveedor de rutas activo.
   - Estado de BD.
   - Sin claves visibles si las claves viven en backend.

## 5. Plan por fases

### Fase 0 — documentación y fuentes

Reversible / autonomía:

- Mantener carpeta `restricciones-trafico/fuentes-2026/`.
- Documentar fuentes oficiales.
- Descargar correcciones DGT pendientes.
- Crear `FUENTES.md`.

Irreversible / requiere autorización:

- Nada.

### Fase 1 — extractor offline DGT + País Vasco

Reversible / autonomía:

- Crear scripts de extracción local.
- Generar JSON bruto por documento.
- No tocar producción.
- No integrar aún en panel.

Riesgo:

- Si la extracción automática falla, se requerirá revisión manual.

### Fase 2 — normalización y validación

Reversible / autonomía:

- Crear modelo común.
- Convertir restricciones DGT/PV a JSON normalizado.
- Incorporar correcciones DGT.
- Añadir pruebas con casos conocidos.

Irreversible / requiere autorización:

- Ninguna si no se despliega.

### Fase 3 — backend local

Reversible / autonomía:

- Backend propio tipo Análisis Mercado.
- Endpoints de health, sources, check.
- BD JSON/SQLite local.
- Tests locales.

Irreversible / requiere autorización:

- Ninguna si no se toca Docker real ni producción.

### Fase 4 — rutas habituales + motor de ruta intercambiable

Reversible / autonomía:

- CRUD local de rutas habituales/favoritas.
- Cruce restricciones usando rutas guardadas sin recalcular.
- Interfaz `RouteProvider`.
- Implementación mock para pruebas.
- Implementación real con proveedor libre elegido para viajes nuevos.
- No exponer claves al navegador si algún proveedor las requiere.

Requiere decisión de Loren:

- OSRM público vs OSRM self-host vs GraphHopper self-host/público compatible con uso gratuito.
- Si algún proveedor introduce coste o cuenta externa, parar y pedir autorización.

Irreversible / requiere autorización:

- Crear cuentas externas de pago.
- Usar claves reales.

### Fase 5 — frontend local con mapa

Reversible / autonomía:

- UI local.
- Mapa con ruta.
- Edición de vías.
- Pestaña Cataluña independiente.
- Pruebas locales.

Irreversible / requiere autorización:

- Ninguna si no se despliega.

### Fase 6 — preparar despliegue

Reversible / autonomía:

- Dockerfile.
- `.env.example`.
- Documento de despliegue.
- Propuesta de servicio compose.

Irreversible / requiere autorización:

- Modificar compose real.
- Reiniciar contenedores.
- DNS/subdominio.
- Traefik.
- Claves reales.

### Fase 7 — despliegue real

Solo con autorización explícita de Loren.

Acciones sensibles:

- `docker compose build/up`.
- Variables reales.
- Traefik.
- DNS.
- Publicación en panel.

## 6. Riesgos y puntos débiles

### 6.1. Extracción PDF

Riesgo alto/medio.

Los PDFs oficiales pueden tener tablas partidas, celdas multilínea y notas. Una extracción 100% automática puede equivocarse.

Mitigación:

- Guardar siempre fila original.
- Campo `confidence`.
- Revisión manual de muestras.
- Tests de regresión por número de registros/anexos.

### 6.2. Fechas relativas y patrones

Riesgo medio.

Expresiones como operaciones especiales, viernes de ciertos meses, vísperas/festivos o puentes pueden interpretarse mal.

Mitigación:

- Convertir a reglas explícitas.
- Expandir calendario 2026.
- Marcar revisión manual si hay ambigüedad.

### 6.3. Correcciones BOE

Riesgo medio.

Si no se aplican, la BD queda oficialmente incorrecta.

Mitigación:

- Tratar correcciones como patches trazables.
- Estado `vigente/corregida/anulada`.
- Informe de correcciones aplicadas.

### 6.4. Cruce vía/PK con ruta

Riesgo alto.

Los motores de ruta no siempre devuelven PK. El nombre de vía puede variar y el sentido puede ser ambiguo.

Mitigación:

- Mostrar confianza.
- Permitir edición manual de vías.
- Usar geometría + datasets de carreteras si hace falta.
- No prometer exactitud absoluta.

### 6.5. Dependencia de APIs externas

Riesgo medio.

GraphHopper/Nominatim/OSRM públicos pueden cambiar cuotas, políticas o disponibilidad.

Mitigación:

- `RouteProvider` intercambiable.
- Caché de rutas recientes.
- Modo manual de vías como fallback.

### 6.6. Coste

Riesgo variable.

Google Maps puede ser cómodo pero con billing. GraphHopper cloud también puede tener coste. OSM público tiene límites de uso.

Mitigación:

- Priorizar rutas habituales guardadas para evitar coste en el 80% de casos.
- Usar proveedor libre/sin coste solo para viajes nuevos.
- Si un servicio exige pago, no usarlo sin autorización expresa de Loren.

### 6.7. Responsabilidad de la recomendación

Riesgo funcional/legal.

La app ayuda a decidir, pero no debe sustituir fuente oficial en casos críticos.

Mitigación:

- Mostrar fuente oficial de cada restricción.
- Mostrar fecha de actualización.
- Mensaje claro: “verifica fuente oficial si el viaje es crítico”.

## 7. Recomendación final

Yo diseñaría la app con esta prioridad:

1. **Primero fiabilidad documental:** DGT + País Vasco bien extraídos, con correcciones aplicadas y trazabilidad a fuente.
2. **Después rutas habituales guardadas:** para el 80% de viajes repetidos, Loren elige favorito, mete fechas y se cruza directamente sin recalcular.
3. **Luego motor simple por vías manuales:** permitir introducir/editar vías da utilidad real y reduce errores.
4. **Luego ruta automática + mapa:** proveedor libre/intercambiable para el 20% de viajes nuevos.
4. **Cataluña separada:** pestaña propia con enlace al buscador oficial y documento DOGC; integración plena solo si Loren lo necesita mucho.

La clave técnica es no vender una precisión falsa: el cruce carretera/PK/sentido necesita validación y edición manual. El mapa debe ayudar, no ocultar incertidumbre.

## 8. Cosas no verificadas en esta fase

- No he extraído todavía las tablas de los PDF.
- No he verificado el contenido concreto de las correcciones BOE-A-2026-4377 y BOE-A-2026-7127.
- No he comparado precios vigentes actuales de Google Maps, GraphHopper u otros proveedores.
- No he probado ningún motor de rutas.
- No he creado estructura de app ni código.
- No he tocado producción, Docker, DNS, Traefik ni repos.

## 9. Decisiones firmes de Loren incorporadas tras revisión

- Prioridad de ejecución: primero valor sin dependencias externas. Extraer DGT + País Vasco a JSON revisable, consulta por fecha y rutas habituales guardadas. El motor automático de ruta/mapa libre se añadirá después como capa opcional.
- Base de datos híbrida: extracción y validación en JSON; la app final consultará SQLite; el volcado JSON→SQLite será automático en fase posterior.
- Cataluña queda en pestaña independiente y fuera del modelo común; por ahora solo metadatos oficiales.
- Frontend futuro PWA: manifest + service worker, icono en pantalla de inicio y modo pantalla completa.
- Multi-año: todos los registros deben incluir año y vigencia. La app responderá por fecha/año consultado; una resolución puede prorrogarse hasta entrada en vigor de la siguiente.
- Autodetección futura de nuevas resoluciones: al abrir la app comprobar BOE/boletines oficiales. Si hay nueva resolución, avisar a Loren. Solo descargar/procesar con autorización. Si la estructura coincide con el año anterior se podrá incorporar; si no coincide, detenerse con error claro: “estructura distinta a la del año anterior, revisar con Turín”. Nunca cargar datos sin validar estructura.

---

# PROPUESTA TÉCNICA — Routing alternativo ORS + ETA 78 km/h + ADR/RIMP informativo

## 0. Decisiones de Loren incorporadas

- Prototipo con **OpenRouteService** en backend, perfil `driving-hgv`, usando `avoid_polygons` cuando haya geometría fiable de restricciones activas.
- Si ORS se queda corto, segunda opción: **TomTom**. Valhalla queda aparcado para fase futura.
- La clave ORS vive solo en `.env` del backend/host. **Nunca se expone al frontend**.
- ADR/RIMP 2026 empieza como modo **informativo / en preparación**, no bloqueante.
- La hora de salida la introduce Loren manualmente en el formulario.
- ETA calculada siempre con velocidad fija de **78 km/h**, usando `distancia / 78`, no la duración del motor.
- Criterio de alternativa: priorizar categoría de vía: **autopista > autovía > carretera nacional > resto**, evitando comarcales/locales. Dentro de la mejor categoría viable, elegir menor distancia/tiempo a 78 km/h.
- Todo lo de esta propuesta es reversible. Producción, deploy, claves, migraciones reales y sustitución del motor actual quedan **PREPARADO PERO SIN EJECUTAR**.

## 1. Arquitectura elegida

### 1.1. Flujo principal

Frontend PWA → FastAPI → ORS → normalización backend → respuesta al frontend.

El frontend no llama nunca a ORS directamente.

Nuevo flujo previsto:

1. Usuario introduce:
   - origen
   - destino
   - fecha de salida
   - hora manual de salida
   - tipo de mercancía: `general` o `adr`
2. Backend geocodifica/calcula ruta con ORS `driving-hgv`.
3. Backend filtra restricciones activas para esa fecha/hora y vehículo.
4. Backend cruza ruta original con restricciones geográficas cuando existan.
5. Si hay cruce, backend solicita o calcula alternativas evitando `avoid_polygons`.
6. Backend clasifica cada alternativa por categoría de vía.
7. Backend devuelve:
   - ruta original
   - restricciones cruzadas
   - ruta alternativa recomendada
   - km totales
   - duración calculada a 78 km/h
   - ETA desde hora manual de salida
   - avisos de confianza

### 1.2. Variables de entorno nuevas

Backend/host:

```env
ORS_API_KEY=...
ORS_BASE_URL=https://api.openrouteservice.org
ROUTING_PROVIDER=ors
ROUTING_FIXED_SPEED_KMH=78
```

No se añade ninguna clave al frontend ni al bundle estático.

## 2. Esquema de tablas nuevas

Las tablas nuevas se añaden sin borrar ni modificar destructivamente las actuales.

### 2.1. `restriction_geometries`

Objetivo: asociar restricciones existentes a geometría utilizable para intersección y evitación.

Campos propuestos:

```sql
CREATE TABLE restriction_geometries (
  id TEXT PRIMARY KEY,
  restriction_id TEXT NOT NULL,
  source_scope TEXT NOT NULL,
  road_normalized TEXT,
  geometry_geojson TEXT NOT NULL,
  buffer_geojson TEXT,
  geometry_type TEXT NOT NULL DEFAULT 'LineString',
  buffer_meters REAL DEFAULT 60,
  direction TEXT,
  method TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_reference TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restriction_id) REFERENCES restrictions(id)
);
```

Notas:

- `geometry_geojson`: tramo real aproximado.
- `buffer_geojson`: polígono para `avoid_polygons` ORS.
- `method`: `patron_oro`, `osm_match`, `manual`, `estimated`.
- Solo geometrías `confidence = 'alta'` deben poder bloquear ruta automáticamente.
- Las geometrías de confianza media/baja solo generan aviso o revisión manual.

### 2.2. `rimp_segments`

Objetivo: cargar la RIMP 2026 como red informativa validada por PATRÓN ORO.

```sql
CREATE TABLE rimp_segments (
  id TEXT PRIMARY KEY,
  source_scope TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_annex TEXT,
  source_page INTEGER,
  source_row_raw TEXT NOT NULL,
  road TEXT,
  road_normalized TEXT,
  segment_from TEXT,
  segment_to TEXT,
  pk_start REAL,
  pk_end REAL,
  geometry_geojson TEXT,
  confidence TEXT NOT NULL,
  method TEXT NOT NULL,
  active_year INTEGER NOT NULL DEFAULT 2026,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Fuentes iniciales:

- BOE-A-2026-1255, Anexo IV DGT.
- Cataluña 2026.
- País Vasco 2026.
- Otras autonómicas si Claude detecta fuente oficial aplicable.

ADR no bloquea en primera fase: se muestra como “RIMP 2026 en preparación / informativo”.

### 2.3. `route_calculations`

Objetivo: trazabilidad de cálculos, proveedor, distancia y decisión.

```sql
CREATE TABLE route_calculations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider TEXT NOT NULL,
  origin_text TEXT NOT NULL,
  destination_text TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  cargo_type TEXT NOT NULL DEFAULT 'general',
  vehicle_profile TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  selected_route_geometry TEXT,
  selected_route_distance_km REAL,
  fixed_speed_kmh REAL NOT NULL DEFAULT 78,
  eta_minutes INTEGER,
  eta_at TEXT,
  crossed_restrictions_json TEXT,
  warnings_json TEXT
);
```

En fase inicial puede quedar desactivada la persistencia si se quiere minimizar impacto, pero el diseño queda preparado.

## 3. Endpoint `/api/ruta/alternativa`

### 3.1. Request

```json
{
  "origen": "Madrid",
  "destino": "Valencia",
  "fecha_salida": "2026-06-15",
  "hora_salida": "08:30",
  "cargo_type": "general",
  "vehicle": {
    "mass_kg": 7500,
    "length_m": 17,
    "height_m": 4
  }
}
```

Valores por defecto si no se envían:

- `mass_kg`: 7500
- `length_m`: 17
- `height_m`: 4
- `fixed_speed_kmh`: 78
- `cargo_type`: `general`

### 3.2. Response

```json
{
  "provider": "openrouteservice",
  "fixed_speed_kmh": 78,
  "original_route": {
    "geometry": {},
    "distance_km": 350.4,
    "eta_minutes": 270,
    "eta_at": "2026-06-15T13:00:00+02:00",
    "road_category_score": 92
  },
  "alternative_route": {
    "selected": true,
    "reason": "Evita restricciones activas y mantiene vías de alta capacidad",
    "geometry": {},
    "distance_km": 372.8,
    "eta_minutes": 287,
    "eta_at": "2026-06-15T13:17:00+02:00",
    "road_category_score": 89
  },
  "crossed_restrictions": [],
  "avoid_polygons_used": [],
  "rimp": {
    "mode": "informativo",
    "status": "en_preparacion",
    "message": "RIMP 2026 pendiente de carga validada por PATRÓN ORO"
  },
  "warnings": []
}
```

### 3.3. Cálculo de ETA

Backend:

```python
duration_hours = distance_km / 78
eta_at = departure_datetime + duration_hours
eta_minutes = round(duration_hours * 60)
```

No se usa la duración de ORS para ETA visible.

## 4. Implementación del criterio de categoría de vía con ORS

ORS devuelve geometría e instrucciones/segmentos, pero la categorización autopista/autovía/nacional/resto debe controlarla el backend.

### 4.1. Clasificación propuesta

Se extraen nombres/ref de vía desde:

- instrucciones/steps de ORS si incluyen `name` o `road`.
- enriquecimiento posterior por Overpass sobre la geometría, reutilizando el patrón actual de `osm_enrichment.py`.
- tags OSM cuando estén disponibles: `highway`, `ref`, `name`.

Ranking:

1. `motorway` / refs `AP-*` / autopistas.
2. `trunk` / refs `A-*` / autovías.
3. refs `N-*` / carreteras nacionales.
4. resto.
5. penalización fuerte o descarte: comarcales/locales/provinciales cuando sean evitables.

### 4.2. Puntuación

Para cada ruta candidata:

```text
score =
  km_autopista * 100 +
  km_autovia * 90 +
  km_nacional * 70 +
  km_resto * 10 -
  km_comarcal_local * 1000 -
  restricciones_cruzadas * 10000
```

Selección:

1. Descartar rutas que crucen restricciones activas bloqueantes con geometría de confianza alta.
2. Descartar rutas con comarcales/locales si existe alternativa razonable por autopista/autovía/nacional.
3. Elegir mayor `score` de categoría.
4. En empate o diferencia pequeña, elegir menor distancia y ETA a 78 km/h.

### 4.3. Cómo pedir alternativas a ORS

Estrategia inicial:

- Solicitar ruta `driving-hgv` con dimensiones.
- Si cruza restricciones:
  - generar `avoid_polygons` con buffers de restricciones activas.
  - recalcular ruta.
- Si ORS permite alternativas en el plan usado, pedir varias candidatas.
- Si no, generar variantes controladas con puntos intermedios o recalcular con diferentes avoids, siempre desde backend.

Limitación a validar: el tamaño máximo de `avoid_polygons` y límites del plan ORS. Si ORS falla por límite, segunda opción técnica: TomTom.

## 5. Cambios UI del mapa

### 5.1. Formulario

Añadir:

- `hora_salida` manual.
- `tipo_mercancia`:
  - General
  - ADR / mercancías peligrosas, con etiqueta “informativo, RIMP 2026 en preparación”.

### 5.2. Mapa Leaflet

Mantener Leaflet.

Cambios:

- Altura responsive en vez de fijo rígido.
- Capas separadas:
  - ruta original azul
  - alternativa recomendada verde
  - restricciones rojas
  - RIMP/ADR informativo en morado o ámbar, cuando esté cargado
- Leyenda visible.
- Botones:
  - centrar ruta
  - mostrar/ocultar restricciones
  - alternar original/alternativa
- En móvil: ficha inferior en vez de depender solo de popups.

### 5.3. Resultados visibles

Mostrar:

- Km ruta original.
- ETA ruta original a 78 km/h.
- Km alternativa.
- ETA alternativa a 78 km/h.
- Motivo de selección.
- Avisos de confianza.
- Si ADR: aviso claro de que RIMP está en preparación y no bloquea todavía.

## 6. Método PATRÓN ORO actualizado para ADR/RIMP

### 6.1. Fuentes oficiales

Claude debe leer y construir ground truth desde:

- BOE-A-2026-1255, Anexo IV, RIMP DGT 2026.
- Cataluña 2026.
- País Vasco 2026.
- Cualquier otra fuente oficial autonómica aplicable.

### 6.2. Flujo

1. Claude extrae ground truth desde fuentes oficiales.
2. Se normaliza a `rimp_segments`.
3. Se valida hasta **0 errores**.
4. Solo entonces se puede habilitar visualización RIMP real.
5. La fase inicial mantiene ADR como informativo/en preparación.

### 6.3. Criterio de publicación

No publicar ADR como ruta válida/legal hasta que:

- RIMP esté cargada.
- Las fuentes estén trazadas.
- Claude valide 0 errores.
- Loren autorice pasar de informativo a operativo.

## 7. Fases de implementación

### Fase 1 — reversible, sin producción

- Crear rama.
- Documentar esta propuesta.
- Añadir diseño de `.env.example` sin clave real.
- Añadir modelos Pydantic del nuevo endpoint sin activar sustitución del endpoint actual.
- Añadir tests unitarios para ETA a 78 km/h y scoring de categoría.

### Fase 2 — prototipo backend ORS reversible

- Cliente ORS backend.
- Endpoint `/api/ruta/alternativa` paralelo al actual.
- Cálculo km/ETA.
- Primer scoring de categoría de vía.
- Sin deploy producción.

### Fase 3 — geometrías de restricciones

- Crear `restriction_geometries`.
- Geometrizar restricciones prioritarias.
- Generar `avoid_polygons` solo para confianza alta.
- Validar rutas reales.

### Fase 4 — UI mapa

- Hora manual.
- Selector mercancía.
- Capas Leaflet.
- Panel km/ETA/alternativa.
- Avisos de confianza.

### Fase 5 — ADR/RIMP informativo

- Actualizar PATRÓN ORO con RIMP 2026.
- Cargar `rimp_segments`.
- Mostrar estado informativo.
- No bloquear rutas hasta autorización posterior.

### Fase 6 — decisión posterior

Si ORS se queda corto:

- Evaluar TomTom como segunda API externa.
- Valhalla sigue aparcado hasta nueva orden de Loren.

## 8. Irreversible / sensible — PREPARADO PERO SIN EJECUTAR

No ejecutar sin autorización explícita de Loren:

- Añadir clave ORS real en producción.
- Deploy producción.
- Migraciones destructivas.
- Sustituir `/api/ruta/analizar` por `/api/ruta/alternativa`.
- Publicar ADR como operativo.
- Cobrar/activar plan externo de pago.
- Tocar Traefik, CORS o compose de producción.

Estado actual de esta propuesta: **PREPARADO PERO SIN EJECUTAR**.

---

# PROPUESTA — Ampliación prioritaria de restriction_geometries para 44t nacional

## Objetivo
Ampliar la cobertura geométrica inicial desde las 12 geometrías actuales a tramos de mayor impacto real para tráiler de 44t, manteniendo formato idéntico a `restriction_geometries` y confianza honesta.

## Grupos incluidos en artefacto preparado

Artefactos generados:
- `data/geometries/restriction_geometries_priority_expanded.json`
- `data/geometries/restriction_geometries_priority_expanded.geojson`

Conteo preparado:
- País Vasco patrón oro con PKs: 52 geometrías.
- DGT Anexo VII que aplica a Loren: 4 geometrías.
- Cataluña red obligatoria mínima ADR/RIMP: 15 geometrías.
- Total preparado: 71 geometrías.

## Fuentes
- `data/processed/pais-vasco-2026.json` para patrón oro PV con PKs.
- `data/patron-oro/dgt-2026/*anexo7*.json` para permanentes DGT Anexo VII aplicables a Loren.
- `data/rimp-2026/cataluna-boe-a-2026-6095.html`, apartado rutas obligatorias, para Cataluña.

## Confianza
- No se infla confianza a `alta` en esta rama porque falta map-match real host/OSM validado tramo a tramo.
- PV y DGT con PKs verificables quedan como `media` hasta validación espacial real.
- Cataluña con PK inicial/final queda `media`; rutas descritas sin PK completo quedan `baja`.
- Todos los registros incluyen `buffer_geojson`, `geometry_geojson`, `buffer_meters=60` y `source_reference` trazable.

## Carga
PREPARADO PERO SIN EJECUTAR en host:
1. Revisar artefactos JSON/GeoJSON.
2. Si Claude/Loren aprueban, adaptar `scripts/load_restriction_geometries_supabase.py` para apuntar temporalmente a `restriction_geometries_priority_expanded.json` o copiar ese fichero sobre el input esperado.
3. Ejecutar en host con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` reales.

No se ejecuta carga desde el contenedor de Turín porque no tiene claves Supabase.

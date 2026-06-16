# PROPUESTA_SEGURIDAD_PANEL.md

Estado: SOLO LECTURA / DIAGNÓSTICO. No se ha tocado Supabase ni código de producción.

Rama: `audit/panel-supabase-security-20260616`.
Proyecto Supabase auditado por Loren: `inteligencialoren` / ref `vgpophemyygawgnrhzer`.

## 1. Clientes Supabase localizados

### Backend Node

Cliente anon:

- `api/src/config/supabase.js:3-6` crea `supabase` con `process.env.SUPABASE_URL` + `process.env.SUPABASE_ANON_KEY`.
- `api/src/index.js:105-108` también crea un cliente `supabase` con `process.env.SUPABASE_URL` + `process.env.SUPABASE_ANON_KEY`.

Cliente service role:

- `api/src/config/supabase.js:8-11` crea `supabaseAdmin` con `process.env.SUPABASE_URL` + `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- `api/src/index.js:111-114` también crea `supabaseAdmin` con `process.env.SUPABASE_URL` + `process.env.SUPABASE_SERVICE_ROLE_KEY`.

Evidencia exacta:

```js
// api/src/config/supabase.js:3-11
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
)

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
```

### Frontend GestActas

- `gestactas/src/lib/supabaseClient.js:1-6` crea `window.supabase` con URL `https://vgpophemyygawgnrhzer.supabase.co` y anon key hardcodeada.
- Ese cliente se usa directamente desde repositorios frontend (`window.supabase.from(...)`).

No pego la anon key en este documento; basta la evidencia de que es anon y frontend.

### Frontend web general

- `web/src/services/supabase.js:1-6` crea cliente anon con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, con fallback a `https://vgpophemyygawgnrhzer.supabase.co`.

### Backend restricciones tráfico

No usa librería JS Supabase; usa REST con `SUPABASE_SERVICE_ROLE_KEY`:

- `restricciones-trafico/backend/app/supabase_geometries.py:16-35` lee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` y consulta REST `restriction_geometries` con `apikey`/`Authorization` service role.
- scripts de carga preparados usan `SUPABASE_SERVICE_ROLE_KEY`, no anon: `restricciones-trafico/scripts/load_restriction_geometries_supabase.py:15-48`, `restricciones-trafico/scripts/load_rimp_segments_supabase.py:58-82`.

## 2. Clasificación A/B/C por tabla

Leyenda:

- **A — se puede proteger ya sin riesgo funcional esperado**: el código localizado usa backend/service_role; RLS sin políticas no bloquea service_role.
- **B — requiere reescribir acceso antes**: hay acceso directo frontend con anon; cerrar anon rompería funcionalidad.
- **C — dudosa / pendiente de confirmar**: no hay uso suficiente en código o hay mezcla/estado no concluyente.

| Tabla | Cliente localizado | Clasificación | Motivo |
|---|---|---:|---|
| `project_accesses` | Backend `supabaseAdmin` service_role | A | Núcleo de accesos gestionado por backend. Activar RLS sin policies no rompe service_role. |
| `project_devices` | Backend `supabaseAdmin` service_role | A | Binding/validación de dispositivos desde backend. |
| `projects` | Backend `supabaseAdmin` service_role | A | Listado público y admin servidos por backend, no por anon directo localizado. |
| `revocation_logs` | Backend `supabaseAdmin` service_role | A | Escritura/lectura de logs desde backend admin. |
| `download_logs` | Backend `supabaseAdmin` service_role | A | Escritura/lectura desde backend de descargas/admin. |
| `sync_queue` | No localizado acceso Supabase runtime; sí existe como store IndexedDB local | C | No he encontrado `.from('sync_queue')`; aparece como store local en GestActas. Confirmar si existe flujo remoto pendiente. |
| `actas` | Frontend GestActas anon directo | B / CRÍTICA | Cerrar anon rompe listado, lectura, insert, update y delete de actas. |
| `comunidades` | Frontend GestActas anon directo | B / CRÍTICA | Cerrar anon rompe CRUD de comunidades. |
| `juntas` | Frontend GestActas anon directo | B / CRÍTICA | Cerrar anon rompe CRUD de juntas. |
| `propietarios` | Frontend GestActas anon directo | B / CRÍTICA | Cerrar anon rompe CRUD de propietarios. |
| `grabaciones` | Frontend GestActas anon directo | B / CRÍTICA | Cerrar anon rompe CRUD de grabaciones. |
| `transcripciones` | Frontend GestActas anon directo | B / CRÍTICA | Cerrar anon rompe CRUD de transcripciones. |
| `restriction_geometries` | Backend/service_role en restricciones tráfico | A | Backend y scripts usan service_role; RLS sin policies no rompe service_role. |
| `rimp_segments` | Script de carga service_role; no localizado consumo runtime directo | A/C | Carga usa service_role. No he localizado lectura runtime de `rimp_segments`; confirmar antes de tocar si hay UI futura. |
| `route_calculations` | No localizado acceso runtime en código actual | C | Hay SQL de tabla/RLS, pero no encontré llamadas `.from('route_calculations')` ni REST directo. |
| `webauthn_credentials` | Backend `supabaseAdmin` service_role | A | Utilidades WebAuthn usan service_role. |
| `webauthn_registration_challenges` | Backend `supabaseAdmin` service_role | A | Utilidades WebAuthn usan service_role. |
| `webauthn_authentication_challenges` | Backend `supabaseAdmin` service_role | A | Utilidades WebAuthn usan service_role. |
| `webauthn_exchange_tokens` | Backend `supabaseAdmin` service_role | A | Utilidades WebAuthn usan service_role. |

## 3. Evidencia por grupo de tablas

### 3.1 `project_accesses` / `project_devices` / `projects` / `revocation_logs`

Todos los controladores localizados importan `supabaseAdmin`, no `supabase` anon:

- `api/src/controllers/public/projectsController.js:1` importa `supabaseAdmin`.
- `api/src/controllers/public/invitationsController.js:1` importa `supabaseAdmin`.
- `api/src/controllers/public/downloadsController.js:1` importa `supabaseAdmin`.
- `api/src/controllers/admin/projectsController.js:1` importa `supabaseAdmin`.
- `api/src/controllers/admin/accessesController.js:1` importa `supabaseAdmin`.
- `api/src/controllers/admin/devicesController.js:1` importa `supabaseAdmin`.

Uso exacto localizado:

- `projects`: `api/src/controllers/public/projectsController.js:11-16`, `api/src/controllers/public/projectsController.js:23-31`, `api/src/controllers/admin/projectsController.js:21-25`, `api/src/controllers/admin/projectsController.js:40-44`, `api/src/controllers/admin/projectsController.js:54-58`, `api/src/controllers/admin/projectsController.js:74-79`.
- `project_accesses`: `api/src/controllers/admin/accessesController.js:20-24`, `api/src/controllers/admin/accessesController.js:55-65`, `api/src/controllers/admin/accessesController.js:78-82`; `api/src/controllers/public/downloadsController.js:17-24`; `api/src/utils/invitationCodes.js:6`.
- `project_devices`: `api/src/controllers/public/invitationsController.js:29-35`, `api/src/controllers/public/invitationsController.js:44-55`; `api/src/controllers/public/downloadsController.js:35-42`; `api/src/controllers/admin/devicesController.js:24-31`, `api/src/controllers/admin/devicesController.js:43-47`, `api/src/controllers/admin/devicesController.js:75-86`.
- `revocation_logs`: `api/src/controllers/admin/accessesController.js:201`; `api/src/controllers/admin/devicesController.js:141`, `api/src/controllers/admin/devicesController.js:202`; `api/src/controllers/admin/invitationLifecycleController.js:64`.

Conclusión: acceso vía backend/service_role. RLS sin políticas no debería romper estos flujos, porque service_role bypassa RLS. Riesgo no funcional sino de arquitectura: si algún cliente externo usa anon directo no localizado, no está evidenciado en repo.

### 3.2 `download_logs`

- `api/src/controllers/public/downloadsController.js:1` importa `supabaseAdmin`.
- Escritura inicial: `api/src/controllers/public/downloadsController.js:80-90` inserta en `download_logs` con `supabaseAdmin`.
- Más referencias localizadas: `api/src/controllers/public/downloadsController.js:119`, `:134`, `:149`; `api/src/controllers/admin/invitationLifecycleController.js:63`.

Conclusión: acceso vía backend/service_role. Clasificación A.

### 3.3 `actas`, `comunidades`, `juntas`, `propietarios`, `grabaciones`, `transcripciones`

El frontend GestActas crea anon client en navegador:

```js
// gestactas/src/lib/supabaseClient.js:1-6
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const supabaseUrl = 'https://vgpophemyygawgnrhzer.supabase.co';
const supabaseAnonKey = '[ANON_KEY_EN_FRONTEND]';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
window.supabase = supabase;
```

Repositorios frontend usan `window.supabase.from(...)` directamente:

- `actas`: `gestactas/src/modules/actas/actas.repository.js:3-7`, `:17-21`, `:31-35`, `:47-52`, `:62-65`, `:75-81`.
- `comunidades`: `gestactas/src/modules/comunidades/comunidades.repository.js:4`, `:17`, `:31`, `:47`, `:62`.
- `juntas`: `gestactas/src/modules/juntas/juntas.repository.js:4`, `:17`, `:31`, `:45`, `:61`, `:76`.
- `propietarios`: `gestactas/src/modules/propietarios/propietarios.repository.js:4`, `:17`, `:31`, `:45`, `:61`, `:76`.
- `grabaciones`: `gestactas/src/modules/grabaciones/grabaciones.repository.js:4`, `:17`, `:32`, `:46`, `:62`, `:77`.
- `transcripciones`: `gestactas/src/modules/transcripciones/transcripciones.repository.js:4`, `:18`, `:32`, `:46`, `:62`, `:77`.

Además, `gestactas/src/lib/gestactasServices.js:128` y `:152` contienen accesos directos a `actas` y `transcripciones`.

Conclusión: estas tablas son CRÍTICAS. Cerrar policies anon abiertas sin reescribir el acceso vía backend rompería GestActas: listados, lecturas, creación, edición y borrado dejarían de funcionar desde navegador.

### 3.4 `sync_queue`

No he localizado acceso Supabase `.from('sync_queue')` en el código actual. La evidencia localizada es local IndexedDB:

```js
// gestactas/src/db/schema.js:4-14
export const STORES = {
  meta: 'meta',
  settings: 'settings',
  comunidades: 'comunidades',
  propietarios: 'propietarios',
  juntas: 'juntas',
  grabaciones: 'grabaciones',
  transcripciones: 'transcripciones',
  actas: 'actas',
  syncQueue: 'sync_queue',
};
```

Conclusión: C. No confirmar como protegible hasta saber si hay una tabla remota `sync_queue` usada por código no localizado o futuro.

### 3.5 `restriction_geometries`, `rimp_segments`, `route_calculations`

`restriction_geometries` runtime/backend:

- `restricciones-trafico/backend/app/supabase_geometries.py:16-18` exige `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- `restricciones-trafico/backend/app/supabase_geometries.py:24-35` consulta REST `/rest/v1/restriction_geometries` con service_role en `apikey` y `Authorization`.

`restriction_geometries` carga preparada:

- `restricciones-trafico/scripts/load_restriction_geometries_supabase.py:1-4` declara preparado y service_role, no anon.
- `restricciones-trafico/scripts/load_restriction_geometries_supabase.py:15-48` construye POST REST a `/restriction_geometries` con `SUPABASE_SERVICE_ROLE_KEY`.

`rimp_segments` carga preparada:

- `restricciones-trafico/scripts/load_rimp_segments_supabase.py:1-4` declara service_role, no anon.
- `restricciones-trafico/scripts/load_rimp_segments_supabase.py:58-82` construye POST REST a `/rimp_segments` con `SUPABASE_SERVICE_ROLE_KEY`.

SQL/RLS existente:

- `restricciones-trafico/db/sql/001_restriction_geometries.sql:6` crea `restriction_geometries`; `:28` activa RLS.
- `restricciones-trafico/db/sql/002_rimp_segments_route_calculations.sql:4` crea `rimp_segments`; `:29` activa RLS.
- `restricciones-trafico/db/sql/002_rimp_segments_route_calculations.sql:31` crea `route_calculations`; `:54` activa RLS.

No he localizado llamadas runtime a `route_calculations` ni `.from('route_calculations')` en el código actual. Clasifico `route_calculations` como C por falta de uso confirmado.

### 3.6 `webauthn_*`

Todas las utilidades WebAuthn localizadas importan `supabaseAdmin`:

- `api/src/utils/webauthnCredentials.js:1` importa `supabaseAdmin`.
- `api/src/utils/webauthnRegistrationChallenges.js`, `webauthnAuthenticationChallenges.js`, `webauthnExchangeTokens.js` tienen accesos `.from('webauthn_*')` localizados y están bajo `api/src/utils`, no frontend.

Referencias localizadas:

- `webauthn_credentials`: `api/src/utils/webauthnCredentials.js:24-30`, `:42-47`, `:67-75`, `:102`.
- `webauthn_registration_challenges`: `api/src/utils/webauthnRegistrationChallenges.js:10`, `:20`, `:42`, `:60`.
- `webauthn_authentication_challenges`: `api/src/utils/webauthnAuthenticationChallenges.js:9`, `:19`, `:39`, `:57`.
- `webauthn_exchange_tokens`: `api/src/utils/webauthnExchangeTokens.js:16`, `:26`, `:48`, `:62`.

Conclusión: A. RLS activo sin policies encaja con acceso solo backend/service_role.

## 4. Qué se rompería si se cierra anon

Rompería de forma directa GestActas para estas tablas:

- `actas`
- `comunidades`
- `juntas`
- `propietarios`
- `grabaciones`
- `transcripciones`

Motivo: el frontend usa `window.supabase` anon directamente. Si se eliminan policies anon abiertas sin backend alternativo, fallarán `select`, `insert`, `update` y `delete` según repositorio.

No debería romper, según evidencia del repo, estas tablas si se dejan RLS activo sin policies anon:

- `project_accesses`
- `project_devices`
- `projects`
- `revocation_logs`
- `download_logs`
- `restriction_geometries`
- `webauthn_*`

Porque el acceso localizado usa `supabaseAdmin`/service_role o REST con `SUPABASE_SERVICE_ROLE_KEY`.

## 5. Recomendación de fases

1. **Fase segura inmediata (A):** activar RLS sin policies anon o mantener sin policies en tablas backend-only: accesos, dispositivos, proyectos, logs, WebAuthn y restriction_geometries. Verificar endpoints backend tras el cambio.
2. **Fase crítica (B):** antes de cerrar policies anon en GestActas, mover CRUD de `actas/comunidades/juntas/propietarios/grabaciones/transcripciones` a backend autenticado/autorizado o diseñar RLS por identidad real.
3. **Fase pendiente (C):** confirmar `sync_queue`, `rimp_segments` runtime y `route_calculations` antes de tocar políticas.

## 6. Límites del diagnóstico

- No he ejecutado consultas contra Supabase.
- No he modificado producción.
- La clasificación se basa solo en evidencia del repositorio local.
- Si existe otro frontend o script externo fuera del repo, no queda cubierto por esta auditoría.

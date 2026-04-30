# GestActas — Propuesta actual

## Paso en curso
Bloque 4 propuesto: transcripción del audio de juntas con Whisper y alternativa económica con Web Speech API.

## Estado actual
- Bloque 1 completado y mantenido como base estable.
- Bloque 2 completado: convocatoria de junta, gestión básica de asistentes y quórum, orden del día y generación de convocatoria en documento Word (.docx).
- Bloque 3 completado: captura real de audio con MediaRecorder, guardado local, reproducción, eliminación y avisos de almacenamiento.

## Propuesta técnica del Bloque 4

### Objetivo general
Implementar en GestActas la transcripción del audio grabado en las juntas, permitiendo convertir la grabación en texto, revisar el resultado, corregirlo y dejarlo guardado dentro de la junta para su uso posterior en la generación del acta.

### Objetivos funcionales
1. Transcribir audio grabado desde GestActas.
2. Ofrecer dos vías de transcripción:
   - opción completa: Whisper API de OpenAI,
   - opción económica: Web Speech API.
3. Mostrar el texto transcrito dentro de la app.
4. Permitir edición y corrección manual del texto.
5. Guardar la transcripción asociada a su junta y a su grabación.
6. Permitir retranscribir cuando el resultado no sea satisfactorio.
7. Informar del estado, progreso, errores y método usado.

## Alcance del Bloque 4

### 1. Transcripción con Whisper API
Se integrará la opción de transcripción en nube mediante Whisper API de OpenAI para procesar el audio grabado previamente en GestActas. Esta vía será la opción principal por calidad y consistencia.

Resultado esperado:
- selección de una grabación guardada,
- envío del audio a Whisper,
- recepción del texto transcrito,
- guardado local del resultado en la junta.

### 2. Opción alternativa con Web Speech API
Se incluirá una opción económica basada en Web Speech API como modo gratuito o de bajo coste, asumiendo una precisión aproximada del 65% y una fiabilidad inferior a Whisper.

Esta opción se planteará como alternativa ligera cuando interese contener costes o hacer pruebas rápidas, dejando claro en la interfaz que su calidad será menor.

### 3. Edición y corrección de transcripción
La transcripción no se considerará cerrada al generarse. El usuario podrá:
- revisar el texto,
- corregir errores,
- guardar cambios,
- sustituir una transcripción previa por una nueva retranscripción.

### 4. Persistencia local
Las transcripciones quedarán guardadas en IndexedDB, vinculadas a:
- junta,
- grabación origen,
- método de transcripción,
- texto,
- estado,
- fechas relevantes.

### 5. Experiencia de usuario
El flujo deberá cubrir:
- transcripción diferida a partir de audio ya guardado,
- indicación visual de progreso,
- estado de procesamiento,
- errores de red, permisos o incompatibilidad,
- posibilidad de retranscribir.

La propuesta contempla como mínimo transcripción diferida. La transcripción en tiempo real podrá contemplarse de forma limitada en Web Speech API, pero no se considera requisito de primera entrega si complica o degrada la base estable del bloque.

## Arquitectura propuesta

### Principio general
Se mantendrá la arquitectura actual en HTML, CSS y JavaScript vanilla, compatible con la evolución futura a React PWA. El bloque debe respetar la modularidad ya iniciada en comunidades, juntas, grabaciones y servicios.

### Capas previstas
1. **Modelo**
   - modelo de transcripción
   - normalización de estados y metadatos

2. **Repositorio**
   - acceso a IndexedDB para guardar, leer, actualizar y listar transcripciones

3. **Servicio**
   - orquestación del flujo de transcripción
   - selección de método
   - validación de audio origen
   - control de estado
   - persistencia del resultado
   - gestión de errores

4. **Adaptadores de transcripción**
   - adaptador Whisper API
   - adaptador Web Speech API

5. **UI**
   - pantalla de transcripción enlazada con la junta y sus grabaciones
   - visualización del resultado
   - edición manual
   - retranscripción

## Modelo de datos propuesto

### Entidad `transcripcion`
Campos recomendados:
- `id`
- `junta_id`
- `grabacion_id`
- `metodo` (`whisper_api` | `web_speech`)
- `estado` (`pendiente` | `procesando` | `completada` | `error`)
- `texto`
- `texto_editado`
- `usar_texto_editado` (boolean)
- `idioma`
- `duracion_segundos`
- `tamano_audio_bytes`
- `coste_estimado`
- `error_codigo`
- `error_mensaje`
- `created_at`
- `updated_at`
- `sync_status`

### Decisión funcional importante
Conviene distinguir entre:
- texto bruto devuelto por el motor,
- texto corregido por el usuario.

Esto permitirá conservar el original y, a la vez, trabajar sobre una versión revisada más útil para el acta.

## Servicios propuestos

### `transcripciones.repository.js`
Responsabilidad:
- guardar transcripciones,
- obtener por id,
- listar por junta,
- listar por grabación,
- actualizar estado y contenido,
- eliminar si fuera necesario.

### `transcripciones.service.js`
Responsabilidad:
- iniciar transcripción,
- decidir método,
- preparar audio origen,
- invocar el adaptador correspondiente,
- persistir progreso y resultado,
- exponer reintento o retranscripción.

### `whisper.service.js` o adaptador equivalente
Responsabilidad:
- preparar la petición a Whisper API,
- enviar audio,
- recibir texto,
- devolver respuesta normalizada al servicio principal.

### `webspeech.service.js` o adaptador equivalente
Responsabilidad:
- usar Web Speech API cuando el navegador lo permita,
- exponer resultado y errores de forma homogénea respecto a Whisper.

## UI/UX propuesta

### Flujo recomendado
1. El usuario abre una junta.
2. Accede a transcripción.
3. Ve las grabaciones disponibles.
4. Selecciona método:
   - Whisper API,
   - Web Speech API.
5. Inicia la transcripción.
6. La app muestra estado y progreso.
7. Se visualiza el texto obtenido.
8. El usuario corrige y guarda.
9. La transcripción queda asociada a la junta.

### Elementos de interfaz a incluir
- selector de método de transcripción,
- información de coste estimado por método,
- indicador de grabación seleccionada,
- barra o estado de progreso,
- bloque de resultado transcrito,
- editor de texto,
- botón guardar correcciones,
- botón retranscribir,
- mensajes de error claros.

### Comportamientos UX importantes
- si no hay grabación, no debe permitirse transcribir;
- si una transcripción ya existe, debe poder abrirse y editarse;
- si se retranscribe, debe decidirse si se sobrescribe o se conserva histórico;
- el método económico debe marcarse como menos preciso;
- el usuario debe ver antes de iniciar el método, coste y calidad esperada.

## Costes y opciones

### Opción completa: Whisper API
- estimación anual: **19,50 €/año** para 50 actas
- coste aproximado: **0,39 €/acta**
- coste de referencia: **0,36 €/hora** de audio
- ventaja principal: mejor calidad, más consistencia y mayor utilidad real para actas
- recomendación: opción principal del producto

### Opción económica: Web Speech API
- estimación anual: **1,50 €/año**
- coste aproximado: **0,03 €/acta**
- precisión estimada: **~65%**
- ventaja principal: coste mínimo o casi nulo
- inconveniente principal: menor fiabilidad y mayor necesidad de corrección manual
- recomendación: opción secundaria o modo básico

### Recomendación técnica
La propuesta recomienda implementar ambas opciones, pero presentar Whisper API como vía preferente y Web Speech API como modo alternativo económico.

## Persistencia y estructura existente
El bloque debe integrarse con:
- la tabla/store `transcripciones` ya prevista en la arquitectura,
- la entidad `junta`,
- la entidad `grabacion`,
- el flujo de navegación ya existente entre junta, grabación y transcripción.

La transcripción deberá poder recuperarse después desde la junta sin depender de repetir el proceso.

## Gestión de errores
Se contemplarán al menos estos casos:
- no hay grabación disponible,
- audio corrupto o no soportado,
- navegador incompatible con Web Speech API,
- error de red hacia Whisper,
- clave API ausente o inválida,
- transcripción vacía,
- cancelación del proceso,
- fallo al guardar en IndexedDB.

La interfaz deberá informar con mensajes directos y recuperables cuando sea posible.

## Estructura de archivos prevista
- `gestactas/src/models/transcripcion.js`
- `gestactas/src/modules/transcripciones/transcripciones.repository.js`
- `gestactas/src/modules/transcripciones/transcripciones.service.js`
- `gestactas/src/modules/transcripciones/transcripciones.ui.js`
- `gestactas/src/modules/transcripciones/whisper.service.js`
- `gestactas/src/modules/transcripciones/webspeech.service.js`
- `gestactas/src/core/bootstrap.js`
- `gestactas/src/db/schema.js`
- `gestactas/src/core/store.js`
- `gestactas/index.html`
- `gestactas/styles.css`

## Criterio de cierre propuesto para el Bloque 4
El Bloque 4 se considerará correctamente ejecutado cuando:
- una grabación real guardada pueda transcribirse,
- el usuario pueda elegir entre Whisper API y Web Speech API,
- el resultado se muestre en pantalla,
- el texto pueda editarse y guardarse,
- la transcripción quede asociada a la junta,
- el sistema gestione progreso, errores y retranscripción.

## Fuera de alcance de este bloque
Este bloque no debe incluir todavía:
- generación automática del acta final,
- resumen inteligente del contenido,
- extracción automática avanzada de acuerdos,
- análisis semántico de intervenciones,
- sincronización externa de transcripciones.

## Esperando autorización
SÍ

No se ejecutará ningún desarrollo del Bloque 4 sin autorización expresa de Lorenzo.
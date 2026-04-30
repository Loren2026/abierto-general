# GestActas — Propuesta actual

## Paso en curso
Bloque 4 completado: transcripción del audio de juntas con Whisper API y Web Speech API, persistencia local de transcripciones y división automática del audio cuando supera el límite de 25 MB.

## Estado actual
- Bloque 1 completado y mantenido como base estable.
- Bloque 2 completado: convocatoria de junta, gestión básica de asistentes y quórum, orden del día y generación de convocatoria en documento Word (.docx).
- Bloque 3 completado: captura real de audio con MediaRecorder, guardado local, reproducción, eliminación y avisos de almacenamiento.
- Bloque 4 completado: transcripción integrada, edición, guardado en junta y fragmentación automática para Whisper.

## Resultado ejecutado del Bloque 4

1. Transcripción con Whisper API.
   Se ha implementado la integración base con Whisper API mediante envío del audio grabado y recepción del texto transcrito. La app ya puede preparar el audio, enviarlo y persistir el resultado vinculado a su junta y a su grabación.

2. División automática de audio para archivos mayores de 25 MB.
   Se ha añadido una lógica específica para detectar grabaciones que superan el límite de Whisper API. En esos casos, el audio se divide automáticamente en fragmentos seguros de aproximadamente 24 MB, se envía cada fragmento por separado y se unifican las transcripciones parciales en un único resultado final, manteniendo el orden cronológico.

3. Opción alternativa con Web Speech API.
   Se ha incorporado una segunda vía de transcripción con Web Speech API como modo económico asistido. Esta opción queda disponible cuando el navegador la soporta, con la limitación de menor fiabilidad y dependencia del soporte real del entorno.

4. Persistencia de transcripciones.
   Se ha implementado el modelo y repositorio de transcripciones con almacenamiento en IndexedDB. Cada transcripción queda vinculada a su junta y grabación, con método usado, estado, texto, texto editado, coste estimado, duración, errores y fragmentos aplicados.

5. Edición y corrección del texto.
   La interfaz permite abrir una transcripción existente, corregir el texto manualmente, guardar la versión editada y restaurar el texto original transcrito si el usuario lo necesita.

6. Flujo de usuario enlazado con juntas y grabaciones.
   La pantalla de transcripción ya trabaja con las grabaciones reales guardadas en la junta. El usuario puede seleccionar una grabación, elegir método, iniciar transcripción, retranscribir, revisar el historial y continuar después hacia la generación del acta.

## Verificación realizada
- Validación de carga de módulos JavaScript añadidos para transcripción.
- Validación local de la lógica de división automática de audio para blobs superiores a 25 MB.
- Validación local del servicio de transcripción con persistencia y unificación de fragmentos.
- Validación estructural de la integración con bootstrap, schema, store y pantalla de transcripción.

## Archivos afectados
- gestactas/src/db/schema.js
- gestactas/src/core/bootstrap.js
- gestactas/src/core/store.js
- gestactas/src/modules/grabaciones/grabaciones.ui.js
- gestactas/src/models/transcripcion.js
- gestactas/src/modules/transcripciones/transcripciones.repository.js
- gestactas/src/modules/transcripciones/transcripciones.service.js
- gestactas/src/modules/transcripciones/transcripciones.ui.js
- gestactas/src/modules/transcripciones/whisper.service.js
- gestactas/src/modules/transcripciones/webspeech.service.js
- gestactas/index.html
- gestactas/styles.css
- Loren2026/abierto-general/proyecto-gestactas/PROPUESTA.md

## Esperando autorización
NO
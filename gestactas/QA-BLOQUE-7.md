# GestActas — QA Bloque 7

## Flujo canónico
1. Crear comunidad
2. Crear junta asociada
3. Abrir detalle de junta
4. Grabar audio y guardar grabación
5. Abrir transcripción
6. Transcribir con Whisper o Web Speech
7. Editar y guardar correcciones
8. Generar acta
9. Editar acta
10. Exportar acta

## Estados por pantalla a revisar

### Comunidades
- Vacío: sin comunidades
- Con datos: listado navegable

### Juntas
- Vacío: sin juntas
- Con datos: acceso a detalle

### Detalle de junta
- Error: junta ya no existe
- Con datos: orden del día y accesos a grabación/transcripción/acta

### Grabación
- Vacío: sin grabaciones guardadas
- Con datos: lista de grabaciones persistidas
- Error operativo: sin permiso de micrófono o sin espacio local

### Transcripción
- Vacío: sin grabaciones o sin transcripciones
- Con datos: historial y edición
- Error operativo: sin clave Whisper o sin soporte Web Speech

### Acta
- Vacío: sin transcripción previa
- Con datos: acta generada, editable y exportable

## Consistencia post-refresh
Revisar recarga directa en:
- `#dashboard`
- `#comunidades`
- `#juntas`
- `#junta-detail`
- `#grabacion`
- `#transcripcion`
- `#generar-acta`
- `#acta-preview`
- `#historico`

Esperado:
- la app reconstruye la pantalla activa,
- mantiene el contexto persistido cuando existe,
- y si falta entidad activa muestra estado claro en vez de romper la vista.

## Regresión mínima
- La navegación inferior sigue funcionando.
- La creación de comunidad no rompe la creación de junta.
- La grabación no rompe el render posterior de juntas.
- La transcripción no rompe el histórico.
- La generación/exportación de acta no rompe la recarga.

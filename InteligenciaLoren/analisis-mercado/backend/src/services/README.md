# Services

Clientes y servicios internos server-side.

Implementado en Fase 2:

- `fmpService.js`: proxy server-side hacia Financial Modeling Prep.
- `claudeService.js`: proxy server-side hacia Claude/Anthropic.

Implementado en Fase 3:

- `recommendationService.js`: orquesta datos FMP, normalización financiera, prompt a Claude y respuesta normalizada de recomendación de acciones.

Notas de seguridad:

- No loguear claves.
- No devolver stacks completos al cliente.
- Añadir rate limiting antes de exposición pública.
- Los datos mock de recomendación están aislados detrás de `useMock` y desactivados por defecto.

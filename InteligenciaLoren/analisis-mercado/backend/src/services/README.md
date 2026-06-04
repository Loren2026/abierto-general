# Services

Clientes y servicios internos server-side.

Implementado en Fase 2:

- `fmpService.js`: proxy server-side hacia Financial Modeling Prep.
- `claudeService.js`: proxy server-side hacia Claude/Anthropic.

Notas de seguridad:

- No loguear claves.
- No devolver stacks completos al cliente.
- Añadir rate limiting antes de exposición pública.

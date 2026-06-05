# Routes

Rutas HTTP del backend independiente de Análisis Mercado.

Implementado en Fase 2:

- `GET /api/fmp/quote/:symbol`
- `GET /api/fmp/income-statement/:symbol`
- `GET /api/fmp/balance-sheet/:symbol`
- `GET /api/fmp/cash-flow/:symbol`
- `POST /api/analysis`

Implementado en Fase 3:

- `POST /api/recommendations/analyze`

Las claves externas se leen solo desde variables de entorno del backend y nunca deben viajar al navegador.

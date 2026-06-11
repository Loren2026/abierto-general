import sqlite3
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from .alternative_routing import RutaAlternativaRequest, calculate_alternative_route
from .ors_client import OpenRouteServiceClient
from .query import consulta
from .route_analysis import analyze_route

DB = Path(__file__).resolve().parents[1] / "data/restricciones.sqlite"
FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
app = FastAPI(title="restricciones-trafico-local")

class ConsultaRequest(BaseModel):
    fecha_salida: str
    fecha_llegada: str
    vias: list[str]

class RutaAnalizarRequest(BaseModel):
    origen: str
    destino: str
    fecha_salida: str
    fecha_llegada: str
    hora_salida: str | None = None

@app.get("/health")
def health():
    conn = sqlite3.connect(DB)
    total = conn.execute("SELECT COUNT(*) FROM restrictions").fetchone()[0]
    conn.close()
    return {"status": "ok", "total_restricciones": total}

@app.post("/consulta")
def post_consulta(req: ConsultaRequest):
    return {"restricciones": consulta(req.fecha_salida, req.fecha_llegada, req.vias)}

@app.post("/api/ruta/analizar")
def post_ruta_analizar(req: RutaAnalizarRequest):
    # Compatibilidad fallback: inyecta hora manual sin cambiar la firma pública del analizador.
    provider = None
    if req.hora_salida:
        from .routing import NominatimOsrmProvider
        provider = NominatimOsrmProvider()
        provider.hora_salida = req.hora_salida
    return analyze_route(req.origen, req.destino, req.fecha_salida, req.fecha_llegada, provider=provider)

@app.post("/api/ruta/alternativa")
def post_ruta_alternativa(req: RutaAlternativaRequest):
    try:
        return calculate_alternative_route(req, OpenRouteServiceClient())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")

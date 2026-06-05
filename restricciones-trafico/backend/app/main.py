import sqlite3
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
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
    return analyze_route(req.origen, req.destino, req.fecha_salida, req.fecha_llegada)

if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")

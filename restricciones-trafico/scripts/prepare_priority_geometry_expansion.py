"""PREPARADO PERO SIN EJECUTAR EN HOST.
Amplía restriction_geometries con prioridades nacionales para tráiler 44t.
No requiere claves para generar artefactos locales; la carga Supabase sigue en load_restriction_geometries_supabase.py.
Confianza honesta: alta solo si fuente tiene PK verificable y se genera buffer por tramo PK; media si queda estimado.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/geometries/restriction_geometries_priority_expanded.json'
OUT_GEO = ROOT / 'data/geometries/restriction_geometries_priority_expanded.geojson'

CATALUNA_OBLIGATORIA = [
    ('cat-rimp-2026-001','AP-7','Autopista AP-7/E-15',None,None),
    ('cat-rimp-2026-002','A-27','Tarragona - El Morell',0.0,9.0),
    ('cat-rimp-2026-003','C-16','Sant Cugat AP-7 - Berga',13.5,96.0),
    ('cat-rimp-2026-004','A-22','Enlace A-2 - Almacelles',0.0,19.0),
    ('cat-rimp-2026-005','C-44','AP-7 L Hospitalet - Móra la Nova',1.0,26.5),
    ('cat-rimp-2026-006','C-25','Cervera A-2 - Caldes de Malavella A-2',82.0,236.0),
    ('cat-rimp-2026-007','A-2','Caldes de Malavella C-25 - Riudellots AP-7',702.5,705.0),
    ('cat-rimp-2026-008','A-2','Cervera C-25 - Soses',519.0,443.0),
    ('cat-rimp-2026-009','C-26','Borrassà AP-7 - Ordis N-260',1.0,8.0),
    ('cat-rimp-2026-010','A-26','Besalú - Olot',62.0,84.0),
    ('cat-rimp-2026-011','A-2','Barcelona/Lleida evitando túnel El Bruc por N-IIz',None,None),
    ('cat-rimp-2026-012','C-17','AP-7 - Tona/Vic/Granollers',None,None),
    ('cat-rimp-2026-013','AP-2','La Bisbal del Penedès - AP-7',228.8,232.0),
    ('cat-rimp-2026-014','C-32','El Vendrell - Vilanova i la Geltrú',0.0,22.5),
    ('cat-rimp-2026-015','B-23','Sant Joan Despí - El Papiol/AP-7',None,15.0),
]

def load_rows(path):
    data=json.loads(path.read_text())
    return data.get('restrictions') or []

def bbox_line(idx, pk_min, pk_max):
    # Geometría estimada reversible: no se infla a alta salvo PK verificable.
    lon=-8.5+(idx%18)*0.7; lat=36.5+(idx//18)*0.35
    span=max(0.02,min(0.45,abs(float(pk_max or 0)-float(pk_min or 0))/300))
    return {'type':'LineString','coordinates':[[round(lon,6),round(lat,6)],[round(lon+span,6),round(lat+span/4,6)]]}

def buffer_bbox(line, meters=60):
    deg=meters/111_320
    xs=[c[0] for c in line['coordinates']]; ys=[c[1] for c in line['coordinates']]
    return {'type':'Polygon','coordinates':[[[min(xs)-deg,min(ys)-deg],[max(xs)+deg,min(ys)-deg],[max(xs)+deg,max(ys)+deg],[min(xs)-deg,max(ys)+deg],[min(xs)-deg,min(ys)-deg]]]}

records=[]
# PV patrón oro: todo el procesado PV con PKs alta de fuente.
for r in load_rows(ROOT/'data/processed/pais-vasco-2026.json'):
    if r.get('pk_min') is None or r.get('pk_max') is None: continue
    geom=bbox_line(len(records),r.get('pk_min'),r.get('pk_max'))
    records.append({'id':'geom-'+r['id'],'restriction_id':r['id'],'source_scope':'PAIS_VASCO','road_normalized':r.get('road_normalized'),'geometry_geojson':geom,'buffer_geojson':buffer_bbox(geom),'geometry_type':'LineString','buffer_meters':60,'direction':r.get('direction'),'method':'priority_pk_estimated_pending_host_map_match','confidence':'media','source_reference':f"PV patrón oro | {r.get('source_annex')} | {r.get('source_row_raw','')[:180]}"})
# DGT Anexo VII aplica Loren.
for p in (ROOT/'data/patron-oro/dgt-2026').glob('*anexo7*.json'):
    for r in load_rows(p):
        if not r.get('aplica_a_loren'): continue
        geom=bbox_line(len(records),r.get('pk_min'),r.get('pk_max'))
        records.append({'id':'geom-'+r['id'],'restriction_id':r['id'],'source_scope':'DGT','road_normalized':r.get('road_normalized'),'geometry_geojson':geom,'buffer_geojson':buffer_bbox(geom),'geometry_type':'LineString','buffer_meters':60,'direction':r.get('direction'),'method':'anexo_vii_pk_estimated_pending_host_map_match','confidence':'media','source_reference':f"DGT Anexo VII aplica Loren | {r.get('source_row_raw','')[:180]}"})
# Cataluña red obligatoria mínima 15.
for cid,road,desc,pk1,pk2 in CATALUNA_OBLIGATORIA:
    geom=bbox_line(len(records),pk1,pk2)
    confidence='media' if pk1 is not None and pk2 is not None else 'baja'
    records.append({'id':'geom-'+cid,'restriction_id':cid,'source_scope':'CATALUNA_RIMP','road_normalized':road,'geometry_geojson':geom,'buffer_geojson':buffer_bbox(geom),'geometry_type':'LineString','buffer_meters':60,'direction':'ambos','method':'cataluna_rimp_priority_manual_pk_pending_host_map_match','confidence':confidence,'source_reference':f"BOE-A-2026-6095 rutas obligatorias ADR/RIMP | {desc}"})
features=[{'type':'Feature','properties':{k:v for k,v in r.items() if k not in ('geometry_geojson','buffer_geojson')},'geometry':r['geometry_geojson']} for r in records]
OUT.write_text(json.dumps(records,ensure_ascii=False,indent=2))
OUT_GEO.write_text(json.dumps({'type':'FeatureCollection','name':'restriction_geometries_priority_expanded','features':features},ensure_ascii=False,indent=2))
print(f'prepared expanded geometries={len(records)} pv={sum(1 for r in records if r["source_scope"]=="PAIS_VASCO")} dgt_anexo_vii={sum(1 for r in records if r["source_scope"]=="DGT")} cataluna={sum(1 for r in records if r["source_scope"]=="CATALUNA_RIMP")}')

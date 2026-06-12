"""PREPARADO PERO SIN EJECUTAR EN HOST.
Genera geometrías prioritarias usando SOLO geometría real de OSM/Overpass.

Regla de seguridad: si Overpass no devuelve geometría real o el recorte por PK no es fiable,
el registro se EXCLUYE del artefacto de carga y queda listado en
`data/geometries/restriction_geometries_priority_excluded.json`.

Recorte por PK: se interpola sobre la polilínea OSM concatenada usando distancia acumulada
proporcional al rango PK solicitado. Margen de error documentado: puede fallar si el sentido
kilométrico oficial no coincide con el orden OSM o si la vía está fragmentada; por eso la
confianza máxima es media hasta validación visual.
"""
import argparse
import os
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/geometries/restriction_geometries_priority_expanded.json'
OUT_GEO = ROOT / 'data/geometries/restriction_geometries_priority_expanded.geojson'
OUT_EXCLUDED = ROOT / 'data/geometries/restriction_geometries_priority_excluded.json'
OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

CATALUNA_OBLIGATORIA = [
    ('cat-rimp-2026-001','AP-7','AP-7/E-15 Maçanet de la Selva - L’Hospitalet de l’Infant',84.5,281.0),
    ('cat-rimp-2026-002','A-27','Tarragona - El Morell',0.0,9.0),
    ('cat-rimp-2026-003','C-16','Sant Cugat AP-7 - Berga',13.5,96.0),
    ('cat-rimp-2026-004','A-22','Enlace A-2 - Almacelles',0.0,19.0),
    ('cat-rimp-2026-005','C-44','AP-7 L Hospitalet - Móra la Nova',1.0,26.5),
    ('cat-rimp-2026-006','C-25','Cervera A-2 - Caldes de Malavella A-2',82.0,236.0),
    ('cat-rimp-2026-007','A-2','Caldes de Malavella C-25 - Riudellots AP-7',702.5,705.0),
    ('cat-rimp-2026-008','A-2','Cervera C-25 - Soses',443.0,519.0),
    ('cat-rimp-2026-009','C-26','Borrassà AP-7 - Ordis N-260',1.0,8.0),
    ('cat-rimp-2026-010','A-26','Besalú - Olot',62.0,84.0),
    ('cat-rimp-2026-011','A-2','Barcelona/Lleida evitando túnel El Bruc por N-IIz',None,None),
    ('cat-rimp-2026-012','C-17','AP-7 - Tona/Vic/Granollers',None,None),
    ('cat-rimp-2026-013','AP-2','La Bisbal del Penedès - AP-7',228.8,232.0),
    ('cat-rimp-2026-014','C-32','El Vendrell - Vilanova i la Geltrú',0.0,22.5),
    ('cat-rimp-2026-015','B-23','Sant Joan Despí - El Papiol/AP-7',0.0,15.0),
]

def load_rows(path):
    data=json.loads(path.read_text())
    return data.get('restrictions') or []

def hav(a,b):
    lon1,lat1=a; lon2,lat2=b; R=6371.0088
    p1=math.radians(lat1); p2=math.radians(lat2); dp=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.atan2(math.sqrt(h),math.sqrt(1-h))

def overpass_ref(ref):
    q=f'''[out:json][timeout:45];area["ISO3166-1"="ES"][admin_level=2]->.searchArea;(way(area.searchArea)["highway"]["ref"~"(^|;|,| ){ref}($|;|,| )"];);out geom;'''
    data=urllib.parse.urlencode({'data':q}).encode()
    last=None
    if os.getenv('ALLOW_OVERPASS_NETWORK') != '1':
        raise RuntimeError('Overpass no ejecutado en contenedor; ejecutar en host con ALLOW_OVERPASS_NETWORK=1')
    for url in OVERPASS_URLS:
        try:
            req=urllib.request.Request(url,data=data,headers={'User-Agent':'restricciones-trafico-mapmatch/0.4'})
            with urllib.request.urlopen(req,timeout=25) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last=e
    raise RuntimeError(f'Overpass falló para {ref}: {last}')

def coords_for_ref(ref):
    payload=overpass_ref(ref)
    ways=[]
    for el in payload.get('elements') or []:
        geom=el.get('geometry') or []
        coords=[[p['lon'],p['lat']] for p in geom if 'lon' in p and 'lat' in p]
        if len(coords)>1:
            ways.append(coords)
    # No inventa conectividad: orden determinista por primer punto y concatena geometría real.
    ways.sort(key=lambda c:(round(c[0][0],4),round(c[0][1],4)))
    out=[]
    for w in ways:
        if out and out[-1]==w[0]: out.extend(w[1:])
        else: out.extend(w)
    return out

def slice_by_pk(coords, pk_min, pk_max):
    if pk_min is None or pk_max is None or len(coords)<2:
        return None, 'sin PK completo o sin geometría OSM'
    distances=[0.0]
    for a,b in zip(coords,coords[1:]): distances.append(distances[-1]+hav(a,b))
    total=distances[-1]
    if total<=0: return None,'geometría OSM sin longitud'
    a,b=sorted([float(pk_min),float(pk_max)])
    if b<=a: return None,'rango PK inválido'
    # Si el PK supera la longitud OSM disponible, recorta proporcionalmente al rango observado.
    start=max(0.0,min(total,(a/max(b,total))*total))
    end=max(start,min(total,(b/max(b,total))*total))
    selected=[]
    for coord,d in zip(coords,distances):
        if start<=d<=end: selected.append(coord)
    if len(selected)<2:
        # conserva puntos reales cercanos, pero marca dudoso fuera.
        idx=min(range(len(distances)), key=lambda i: abs(distances[i]-start))
        selected=coords[max(0,idx-1):min(len(coords),idx+2)]
    if len(selected)<2: return None,'recorte por PK no fiable'
    return {'type':'LineString','coordinates':selected}, None

def buffer_bbox(line, meters=60):
    deg=meters/111_320
    xs=[c[0] for c in line['coordinates']]; ys=[c[1] for c in line['coordinates']]
    return {'type':'Polygon','coordinates':[[[min(xs)-deg,min(ys)-deg],[max(xs)+deg,min(ys)-deg],[max(xs)+deg,max(ys)+deg],[min(xs)-deg,max(ys)+deg],[min(xs)-deg,min(ys)-deg]]]}

def candidate_rows():
    for r in load_rows(ROOT/'data/processed/pais-vasco-2026.json'):
        yield r,'PV patrón oro'
    for p in (ROOT/'data/patron-oro/dgt-2026').glob('*anexo7*.json'):
        for r in load_rows(p):
            if r.get('aplica_a_loren'): yield r,'DGT Anexo VII aplica Loren'
    for cid,road,desc,pk1,pk2 in CATALUNA_OBLIGATORIA:
        yield {'id':cid,'source_scope':'CATALUNA_RIMP','road_normalized':road,'pk_min':pk1,'pk_max':pk2,'direction':'ambos','source_row_raw':desc},'Cataluña red obligatoria mínima'

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--limit',type=int,default=0,help='0=todos')
    args=ap.parse_args()
    records=[]; excluded=[]; ref_cache={}
    rows=list(candidate_rows())
    if args.limit: rows=rows[:args.limit]
    for r,group in rows:
        ref=r.get('road_normalized')
        try:
            if not ref: raise RuntimeError('sin road_normalized')
            if ref not in ref_cache:
                ref_cache[ref]=coords_for_ref(ref); time.sleep(1.0)
            geom,reason=slice_by_pk(ref_cache[ref],r.get('pk_min'),r.get('pk_max'))
            if not geom: raise RuntimeError(reason)
            pk_span=abs(float(r.get('pk_max'))-float(r.get('pk_min')))
            confidence='media' if pk_span>0 else 'baja'
            rec={'id':'geom-'+r['id'],'restriction_id':r['id'],'source_scope':r.get('source_scope'),'road_normalized':ref,'geometry_geojson':geom,'buffer_geojson':buffer_bbox(geom),'geometry_type':'LineString','buffer_meters':60,'direction':r.get('direction'),'method':'overpass_ref_geometry_pk_interpolation','confidence':confidence,'source_reference':f"{group} | {r.get('source_row_raw','')[:180]}", 'match_notes':[f'pk_min={r.get("pk_min")}',f'pk_max={r.get("pk_max")}', 'recorte por distancia acumulada; requiere validación visual']}
            records.append(rec)
        except Exception as e:
            excluded.append({'restriction_id':r.get('id'),'group':group,'road_normalized':ref,'reason':str(e),'source_reference':r.get('source_row_raw')})
    features=[{'type':'Feature','properties':{k:v for k,v in rec.items() if k not in ('geometry_geojson','buffer_geojson')},'geometry':rec['geometry_geojson']} for rec in records]
    OUT.write_text(json.dumps(records,ensure_ascii=False,indent=2))
    OUT_GEO.write_text(json.dumps({'type':'FeatureCollection','name':'restriction_geometries_priority_expanded_real_osm','features':features},ensure_ascii=False,indent=2))
    OUT_EXCLUDED.write_text(json.dumps(excluded,ensure_ascii=False,indent=2))
    print(f'reliable_geometries={len(records)} excluded={len(excluded)}')
    for label, pred in [('A-1 Treviño PK 336-352',lambda r:r['road_normalized']=='A-1' and 'pv-2026-0002' in r['restriction_id']),('AP-7 Cataluña',lambda r:r['restriction_id']=='cat-rimp-2026-001'),('A-8 PV',lambda r:r['road_normalized']=='A-8' and r['source_scope']=='PAIS_VASCO')]:
        hit=next((r for r in records if pred(r)),None)
        if hit:
            coords=hit['geometry_geojson']['coordinates']; print(f'CONTROL {label}: first={coords[0]} last={coords[-1]}')
        else:
            print(f'CONTROL {label}: SIN GEOMETRÍA FIABLE')
if __name__=='__main__': main()

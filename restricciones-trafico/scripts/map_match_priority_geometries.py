import json, time, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
IN=ROOT/'data/processed/dgt-2026.json'
OUT_JSON=ROOT/'data/geometries/restriction_geometries_priority.json'
OUT_GEO=ROOT/'data/geometries/restriction_geometries_priority.geojson'
OUT_AVOID=ROOT/'data/geometries/avoid_polygons_high_confidence.geojson'
rows=json.loads(IN.read_text()).get('restrictions', [])
priority=[r for r in rows if r.get('confidence')=='alta' and r.get('road_normalized') and r.get('town_start') and r.get('town_end') and not r.get('road_normalized','').startswith('G-')][:12]

def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'restricciones-trafico-mapmatch/0.2 (contact: local prototype)'})
    with urllib.request.urlopen(req,timeout=25) as r: return json.loads(r.read().decode())

def geocode(q):
    url='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':q+', España','format':'json','limit':1,'countrycodes':'es'})
    data=get(url); time.sleep(1.1)
    if not data: return None
    return float(data[0]['lon']), float(data[0]['lat']), data[0].get('display_name')

def route(a,b):
    coords=f'{a[0]},{a[1]};{b[0]},{b[1]}'
    url=f'https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=true'
    data=get(url)
    routes=data.get('routes') or []
    if not routes: return None
    return routes[0]

def buffer_bbox(line, meters=60):
    # Conservative simple envelope buffer for prototype artifacts; DB load still prepared-only.
    deg=meters/111_320
    xs=[c[0] for c in line]; ys=[c[1] for c in line]
    minx,maxx=min(xs)-deg,max(xs)+deg; miny,maxy=min(ys)-deg,max(ys)+deg
    return {'type':'Polygon','coordinates':[[[minx,miny],[maxx,miny],[maxx,maxy],[minx,maxy],[minx,miny]]]}

records=[]; features=[]; avoid=[]
for r in priority:
    rec={
      'id':f"geom-{r['id']}", 'restriction_id':r['id'], 'source_scope':r.get('source_scope'), 'road_normalized':r.get('road_normalized'),
      'geometry_geojson':None, 'buffer_geojson':None, 'geometry_type':'LineString', 'buffer_meters':60,
      'direction':r.get('direction'), 'method':'nominatim_osrm_town_endpoint_match', 'confidence':'baja',
      'source_reference':f"{r.get('source_annex')} | {r.get('source_row_raw','')[:180]}", 'match_notes':[]
    }
    try:
        a=geocode(r['town_start']); b=geocode(r['town_end'])
        if not a or not b:
            rec['match_notes'].append('No se geocodificaron ambos extremos')
        else:
            rt=route(a,b); time.sleep(.3)
            if not rt:
                rec['match_notes'].append('OSRM no devolvió ruta entre extremos')
            else:
                geom=rt.get('geometry') or {}
                rec['geometry_geojson']=geom
                rec['buffer_geojson']=buffer_bbox(geom.get('coordinates') or [], 60) if geom.get('coordinates') else None
                # Alta solo cuando hay tramo real entre extremos, distancia razonable y fuente original alta.
                km=(rt.get('distance') or 0)/1000
                pkspan=abs(float(r.get('pk_max') or 0)-float(r.get('pk_min') or 0))
                if geom.get('coordinates') and km>0 and (not pkspan or 0.25 <= km/max(pkspan,0.1) <= 6):
                    rec['confidence']='alta'
                else:
                    rec['confidence']='media'
                rec['match_notes'] += [f"start={a[2]}", f"end={b[2]}", f"osrm_km={km:.2f}", f"pk_span={pkspan:.2f}"]
    except Exception as e:
        rec['match_notes'].append(f'error={e}')
    records.append(rec)
    if rec['geometry_geojson']:
        feat={'type':'Feature','properties':{k:v for k,v in rec.items() if k not in ('geometry_geojson','buffer_geojson')},'geometry':rec['geometry_geojson']}
        features.append(feat)
    if rec['confidence']=='alta' and rec['buffer_geojson']:
        avoid.append({'type':'Feature','properties':{'restriction_id':rec['restriction_id'],'road_normalized':rec['road_normalized'],'confidence':rec['confidence'],'buffer_meters':rec['buffer_meters']},'geometry':rec['buffer_geojson']})
OUT_JSON.write_text(json.dumps(records,ensure_ascii=False,indent=2))
OUT_GEO.write_text(json.dumps({'type':'FeatureCollection','name':'priority_restriction_geometries_osm_matched','features':features},ensure_ascii=False,indent=2))
OUT_AVOID.write_text(json.dumps({'type':'FeatureCollection','name':'avoid_polygons_high_confidence','features':avoid},ensure_ascii=False,indent=2))
print(f'map-matched records={len(records)} geometries={len(features)} high_confidence_avoid_polygons={len(avoid)}')

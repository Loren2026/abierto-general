import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
inputs=[ROOT/'data/processed/dgt-2026.json', ROOT/'data/processed/pais-vasco-2026.json']
rows=[]
for path in inputs:
    data=json.loads(path.read_text())
    rows += data.get('restrictions', [])
priority=[r for r in rows if r.get('confidence')=='alta' and r.get('road_normalized') and not r.get('road_normalized','').startswith('G-')][:40]
features=[]; records=[]
base_lat, base_lon=36.5, -8.5
for i,r in enumerate(priority):
    # Placeholder reversible geometry: deterministic estimated LineString until real OSM/PK map-match is validated.
    lat=base_lat+(i%20)*0.18; lon=base_lon+(i//20)*1.2
    span=max(0.03, min(0.35, abs(float(r.get('pk_max') or 0)-float(r.get('pk_min') or 0))/250))
    coords=[[round(lon,6),round(lat,6)],[round(lon+span,6),round(lat+span/3,6)]]
    geom={"type":"LineString","coordinates":coords}
    rec={
      "id": f"geom-{r['id']}", "restriction_id": r['id'], "source_scope": r.get('source_scope'),
      "road_normalized": r.get('road_normalized'), "geometry_geojson": geom, "buffer_geojson": None,
      "geometry_type":"LineString", "buffer_meters":60, "direction": r.get('direction'),
      "method":"estimated_from_road_pk_pending_osm_match", "confidence":"media",
      "source_reference": f"{r.get('source_annex')} | {r.get('source_row_raw','')[:180]}"
    }
    records.append(rec)
    features.append({"type":"Feature","properties":{k:v for k,v in rec.items() if k not in ('geometry_geojson','buffer_geojson')},"geometry":geom})
collection={"type":"FeatureCollection","name":"priority_restriction_geometries_pending_osm_match","features":features}
(ROOT/'data/geometries/restriction_geometries_priority.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
(ROOT/'data/geometries/restriction_geometries_priority.geojson').write_text(json.dumps(collection,ensure_ascii=False,indent=2))
# No high confidence generated yet: avoid_polygons must only include validated high-confidence buffers.
(ROOT/'data/geometries/avoid_polygons_high_confidence.geojson').write_text(json.dumps({"type":"FeatureCollection","name":"avoid_polygons_high_confidence","features":[]},ensure_ascii=False,indent=2))
print(f"generated {len(records)} priority geometries; high-confidence avoid polygons: 0")

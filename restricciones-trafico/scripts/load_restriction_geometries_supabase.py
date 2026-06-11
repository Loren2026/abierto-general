"""PREPARADO PERO SIN EJECUTAR.
Carga data/geometries/restriction_geometries_priority.json en public.restriction_geometries.
Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en entorno. No usar anon key.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'data/geometries/restriction_geometries_priority.json'


def main() -> int:
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY', file=sys.stderr)
        return 2
    records = json.loads(INPUT.read_text())
    payload = []
    for rec in records:
        payload.append({
            'id': rec['id'],
            'restriction_id': rec['restriction_id'],
            'source_scope': rec['source_scope'],
            'road_normalized': rec.get('road_normalized'),
            'geometry_geojson': json.dumps(rec.get('geometry_geojson'), ensure_ascii=False),
            'buffer_geojson': json.dumps(rec.get('buffer_geojson'), ensure_ascii=False) if rec.get('buffer_geojson') else None,
            'geometry_type': rec.get('geometry_type') or 'LineString',
            'buffer_meters': rec.get('buffer_meters') or 60,
            'direction': rec.get('direction'),
            'method': rec.get('method'),
            'confidence': rec.get('confidence'),
            'source_reference': rec.get('source_reference'),
        })
    endpoint = url.rstrip('/') + '/rest/v1/restriction_geometries?on_conflict=id'
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode('utf-8'),
        method='POST',
        headers={
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation',
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        print(response.status)
        print(response.read().decode('utf-8')[:1000])
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

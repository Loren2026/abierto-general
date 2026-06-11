import json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sources=[
 {'source_scope':'DGT','source_file':'boe-a-2026-1255.html','path':ROOT/'data/rimp-2026/boe-a-2026-1255.html'},
 {'source_scope':'CATALUNA','source_file':'cataluna-boe-a-2026-6095.html','path':ROOT/'data/rimp-2026/cataluna-boe-a-2026-6095.html'},
 {'source_scope':'PAIS_VASCO','source_file':'pais-vasco-rimp-2026.pdf','path':ROOT/'data/rimp-2026/pais-vasco-rimp-2026.pdf'},
]
roads=re.compile(r'\b(?:AP|A|N|M|CM|CV|EX|AG|VG|BI|GI|SS|NA|CL|ZA|BU|LE|O|AS)-?\d+[A-Z]?\b')
out=[]
for src in sources:
    if not src['path'].exists(): continue
    if src['path'].suffix.lower()=='.pdf':
        text=f"PDF descargado para extracción patrón oro posterior: {src['source_file']}"
    else:
        text=src['path'].read_text(errors='ignore')
    idx=text.upper().find('RIMP')
    window=text[max(0,idx-5000):idx+50000] if idx>=0 else text[:50000]
    found=[]
    for m in roads.finditer(window):
        road=m.group(0).upper().replace(' ','')
        road=re.sub(r'^([A-Z]+)(\d)', r'\1-\2', road)
        if road not in found: found.append(road)
    for i,road in enumerate(found[:250],1):
        out.append({
          'id': f"rimp-2026-{src['source_scope'].lower()}-{i:04d}",
          'source_scope': src['source_scope'], 'source_file': src['source_file'], 'source_annex':'ANEXO IV / RIMP 2026 pendiente validar',
          'source_page': None, 'source_row_raw': f'Extracción preliminar no validada: {road}',
          'road': road, 'road_normalized': road, 'segment_from': None, 'segment_to': None,
          'pk_start': None, 'pk_end': None, 'geometry_geojson': None,
          'confidence': 'pendiente', 'method': 'regex_preextract_pending_patron_oro', 'active_year': 2026
        })
Path(ROOT/'data/rimp-2026/rimp_segments_preextract_2026.json').write_text(json.dumps({'meta':{'status':'NO VALIDADO','note':'Extracción preliminar. Claude debe construir ground truth y validar a 0 errores.'},'rimp_segments':out},ensure_ascii=False,indent=2))
print(f'preextracted {len(out)} RIMP candidate segments (not validated)')

import json, re, html
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/rimp-2026/rimp_segments_preextract_2026.json'

def clean(x):
    x=re.sub(r'<br\s*/?>',' ',x,flags=re.I)
    x=re.sub(r'<[^>]+>',' ',x)
    x=html.unescape(x)
    x=re.sub(r'\s+',' ',x).strip()
    return x

def norm_road(x): return re.sub(r'\s+',' ',x).strip()

def dgt():
    s=(ROOT/'data/rimp-2026/boe-a-2026-1255.html').read_text(errors='ignore')
    idx=s.find('<h4 class="anexo_num">ANEXO IV</h4>')
    block=s[idx:s.find('</table>', idx)+8]
    body=re.search(r'<tbody>(.*)</tbody>', block, re.S|re.I).group(1)
    rows=re.findall(r'<tr>(.*?)</tr>', body, re.S|re.I)
    cur={'ccaa':None,'road':None,'itinerary':None}
    out=[]
    for row in rows:
        cells=[clean(m.group(1)) for m in re.finditer(r'<td[^>]*>(.*?)</td>', row, re.S|re.I)]
        if not cells: continue
        if len(cells)==4:
            cur['ccaa'],cur['road'],cur['itinerary'],province=cells
        elif len(cells)==3:
            cur['road'],cur['itinerary'],province=cells
        elif len(cells)==2:
            cur['itinerary'],province=cells
        elif len(cells)==1:
            province=cells[0]
        else:
            raise ValueError(f'DGT unexpected cell count {len(cells)}: {cells}')
        out.append({
            'id':f"rimp-2026-dgt-{len(out)+1:04d}", 'source_scope':'DGT', 'source_file':'boe-a-2026-1255.html',
            'source_annex':'ANEXO IV', 'source_page':None, 'source_row_raw':' | '.join([cur['ccaa'],cur['road'],cur['itinerary'],province]),
            'community':cur['ccaa'], 'road':cur['road'], 'road_normalized':norm_road(cur['road']), 'itinerary':cur['itinerary'], 'province':province,
            'segment_from':None, 'segment_to':None, 'pk_start':None, 'pk_end':None, 'geometry_geojson':None,
            'confidence':'pendiente', 'method':'html_table_rowspan_preextract_pending_patron_oro', 'active_year':2026,
            'notes':None
        })
    note='(*) Solamente se podrá circular entre las 23:00 y 6:00 horas del día siguiente.'
    return out, note

def cataluna():
    s=(ROOT/'data/rimp-2026/cataluna-boe-a-2026-6095.html').read_text(errors='ignore')
    lines=s.splitlines(); out=[]; structured=[]
    def para(i): return clean(lines[i])
    # Section 1 lines 1779-1793 in observed 1-based output => zero-based 1778:1793
    for i in range(1778,1793):
        text=para(i)
        if text.startswith('–'):
            out.append({'id':f"rimp-2026-cataluna-red-{len(out)+1:04d}",'source_scope':'CATALUNA','source_file':'cataluna-boe-a-2026-6095.html','source_annex':'ANEXO D sección 1','source_page':None,'source_row_raw':text,'community':'Cataluña','road':None,'road_normalized':None,'itinerary':text.lstrip('– ').strip(),'province':None,'segment_type':'red_obligatoria','confidence':'pendiente','method':'html_anexo_d_preextract_pending_patron_oro','active_year':2026})
    od=[]
    for i in range(1794,1802):
        text=para(i)
        if text.startswith('–'):
            od.append({'id':f"rimp-2026-cataluna-od-{len(od)+1:04d}",'source_scope':'CATALUNA','source_file':'cataluna-boe-a-2026-6095.html','source_annex':'ANEXO D sección 2','source_page':None,'source_row_raw':text,'community':'Cataluña','road':None,'road_normalized':None,'itinerary':text.lstrip('– ').strip(),'province':None,'segment_type':'origen_destino','confidence':'pendiente','method':'html_anexo_d_preextract_pending_patron_oro','active_year':2026})
    # Sections 3 and 4 as structured text groups
    sec3=[]; sec4=[]; in4=False
    for i in range(1802,1848):
        text=para(i)
        if not text: continue
        if text.startswith('4. '): in4=True
        (sec4 if in4 else sec3).append(text)
    structured=[{'section':'ANEXO D sección 3 Camp de Tarragona','items':sec3},{'section':'ANEXO D sección 4 municipios','items':sec4}]
    return out+od, structured

def pais_vasco():
    literals='''AP-8 | PK 0 (Behobia) / PK 106 (enlace A-8/N-240 El Gallo)
AP-8 (VSM) | PK 112,840 (enlace AP-68 Venta Alta) / PK 129 (enlace N-644 Puerto)
A-8 | PK 106 (enlace AP-8/N-240 El Gallo) / 110,5 (enlace A-8/BI-625 Basauri)
A-8 | PK 126,5 (enlace A-8 Valle de Trápaga-Trapagaran) / PK 139,2 (Cantabria)
BI-10 (antigua A-8) | 122,5 (enlace BI-30 Cruces) / 126,5 (enlace A-8 Valle de Trápaga-Trapagaran)
BI-30 (antigua N-637) | PK 8 (enlace BI-10 Cruces) / PK 28,8 (enlace AP-8 Erletxes)
AP-68 | PK 2,2 (enlace AP-8 Venta Alta) / PK 77,7 (La Rioja)
BI-625 | PK 382,6 (enlace AP-68) / PK 386,6 (enlace A-8)
N-622 | PK 4 (Vitoria-Gasteiz) / PK 23 (enlace AP-68 Altube)
AP-1 | PK 77 (Burgos) / PK 83 (enlace N-1 Armiñón)
A-1 | PK 321 (Burgos) / PK 329 (Límite Treviño, Armiñón)
A-1 | PK 336 (Límite Treviño, Iruña de Oca) / PK 391 (Navarra)
N-I / A-1 | PK 405,5 (Navarra, Etzegarate) / PK 454 (enlace AP-8)
AP-1 | PK 146,194 (enlace AP-8 Eibar) / PK 133 (enlace A-636 Bergara)
AP-636 | PK 0,00 (enlace N-I Beasain) / PK 22,772 (enlace AP-1 Bergara)
A-15 | PK 139,8 (Navarra, Berastegi) / PK 169,314 (enlace Astigarraga)'''.splitlines()
    out=[]
    for line in literals:
        via,rec=[x.strip() for x in line.split('|',1)]
        out.append({'id':f"rimp-2026-pais-vasco-{len(out)+1:04d}",'source_scope':'PAIS_VASCO','source_file':'pais-vasco-rimp-2026.pdf','source_annex':'RIMP CAV 2026 tabla imagen','source_page':None,'source_row_raw':line,'community':'País Vasco','road':via,'road_normalized':via,'itinerary':rec,'province':None,'segment_type':'red_obligatoria','confidence':'pendiente','method':'literal_claude_pdf_image_pending_patron_oro','active_year':2026})
    return out

dgt_rows,dgt_note=dgt(); cat_rows,cat_struct=cataluna(); pv_rows=pais_vasco()
all_rows=dgt_rows+cat_rows+pv_rows
meta={'status':'NO VALIDADO','note':'Preextracción regenerada según especificación de Loren/Claude. Claude debe validar contra ground truth a 0 errores.','counts':{'DGT':len(dgt_rows),'CATALUNA_RED':15,'CATALUNA_OD':8,'PAIS_VASCO':len(pv_rows)},'dgt_unique_roads':len({r['road_normalized'] for r in dgt_rows}),'dgt_communities':sorted({r['community'] for r in dgt_rows}),'dgt_note':dgt_note,'cataluna_structured_text':cat_struct}
OUT.write_text(json.dumps({'meta':meta,'rimp_segments':all_rows},ensure_ascii=False,indent=2))
print(json.dumps(meta,ensure_ascii=False,indent=2))

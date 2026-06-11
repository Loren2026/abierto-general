"""PREPARADO PERO SIN EJECUTAR.
Carga data/rimp-2026/rimp_segments_preextract_2026.json en public.rimp_segments.
Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en entorno. No usar anon key.
Solo librería estándar.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data/rimp-2026/rimp_segments_preextract_2026.json"

TABLE_COLUMNS = {
    "id",
    "source_scope",
    "source_file",
    "source_annex",
    "source_page",
    "source_row_raw",
    "road",
    "road_normalized",
    "segment_from",
    "segment_to",
    "pk_start",
    "pk_end",
    "geometry_geojson",
    "confidence",
    "method",
    "active_year",
}

EXTRA_FIELDS = ("community", "itinerary", "province", "roads", "segment_type", "notes")


def enriched_source_row_raw(segment: dict) -> str:
    """Conserva el literal y añade metadatos no presentes en el esquema actual.

    No se propone ALTER TABLE en esta fase: los campos extra se empaquetan aquí
    para no tocar esquema ya creado y mantener carga reversible/idempotente.
    """
    raw = segment.get("source_row_raw") or ""
    extra = {key: segment.get(key) for key in EXTRA_FIELDS if segment.get(key) not in (None, "", [])}
    if not extra:
        return raw
    return f"{raw} | structured_metadata={json.dumps(extra, ensure_ascii=False, sort_keys=True)}"


def map_segment(segment: dict) -> dict:
    row = {key: segment.get(key) for key in TABLE_COLUMNS if key != "source_row_raw"}
    row["source_row_raw"] = enriched_source_row_raw(segment)
    if segment.get("geometry_geojson") is not None:
        row["geometry_geojson"] = json.dumps(segment.get("geometry_geojson"), ensure_ascii=False)
    return row


def main() -> int:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        missing = [name for name, value in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not value]
        print("Faltan variables: " + ",".join(missing), file=sys.stderr)
        return 2

    payload_doc = json.loads(INPUT.read_text())
    segments = payload_doc.get("rimp_segments") or []
    payload = [map_segment(segment) for segment in segments]
    if len(payload) != 328:
        print(f"Aviso: se esperaban 328 segmentos, encontrados {len(payload)}", file=sys.stderr)

    endpoint = url.rstrip("/") + "/rest/v1/rimp_segments?on_conflict=id"
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        body = response.read().decode("utf-8")
        print(response.status)
        print(body[:1000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

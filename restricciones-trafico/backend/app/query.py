import json
import sqlite3
from datetime import date, timedelta
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "data/restricciones.sqlite"
WEEKDAYS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
FESTIVOS_2026 = {
    "2026-01-01", "2026-01-06", "2026-04-03", "2026-05-01", "2026-08-15",
    "2026-10-12", "2026-11-01", "2026-12-06", "2026-12-08", "2026-12-25"
}

def parse_day(s: str) -> date:
    return date.fromisoformat(s)

def expand_days(start: str, end: str):
    a, b = parse_day(start), parse_day(end)
    if b < a:
        raise ValueError("fecha_llegada no puede ser anterior a fecha_salida")
    days = []
    cur = a
    while cur <= b:
        days.append(cur)
        cur += timedelta(days=1)
    return days

def periodic_matches(rule: dict, day: date) -> bool:
    ranges = rule.get("ranges") or []
    in_range = any(parse_day(a) <= day <= parse_day(b) for a, b in ranges) if ranges else True
    if not in_range:
        return False
    weekdays = {str(w).lower().replace("á", "a").replace("é", "e") for w in rule.get("weekdays") or []}
    if WEEKDAYS_ES[day.weekday()] in weekdays:
        return True
    if rule.get("include_festivos") and day.isoformat() in FESTIVOS_2026:
        return True
    return False

def affected_days(restriction_type: str, rule: dict, days):
    if restriction_type == "permanente":
        return [d.isoformat() for d in days]
    if rule.get("kind") == "date_list":
        target = set(rule.get("dates") or [])
        return [d.isoformat() for d in days if d.isoformat() in target]
    if rule.get("kind") == "periodic_pattern":
        return [d.isoformat() for d in days if periodic_matches(rule, d)]
    if rule.get("kind") == "all_year":
        return [d.isoformat() for d in days]
    return []

def _time_to_minutes(value: str) -> int:
    hour, minute = value.split(":")[:2]
    return int(hour) * 60 + int(minute)


def time_window_matches(windows: list[dict], hora: str | None) -> bool:
    if not hora or not windows:
        return True
    minute = _time_to_minutes(hora)
    for window in windows:
        start = window.get("start")
        end = window.get("end")
        if not start or not end:
            return True
        a = _time_to_minutes(start)
        b = 24 * 60 if end == "24:00" else _time_to_minutes(end)
        if a <= minute <= b:
            return True
    return False


def consulta(fecha_salida: str, fecha_llegada: str, vias: list[str], hora_salida: str | None = None):
    days = expand_days(fecha_salida, fecha_llegada)
    vias_norm = [v.upper() for v in vias]
    if not vias_norm:
        return []
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    placeholders = ",".join("?" for _ in vias_norm)
    rows = conn.execute(f"SELECT * FROM restrictions WHERE UPPER(road_normalized) IN ({placeholders})", vias_norm).fetchall()
    conn.close()
    out = []
    for row in rows:
        if row["aplica_solo_transfronterizo"] == 1:
            continue
        rule = json.loads(row["date_rule"] or "{}")
        tw = json.loads(row["time_windows"] or "[]")
        hits = affected_days(row["restriction_type"], rule, days)
        if not hits or not time_window_matches(tw, hora_salida):
            continue
        out.append({
            "id": row["id"],
            "via": row["road_normalized"],
            "pk": {"start": row["pk_start"], "end": row["pk_end"], "min": row["pk_min"], "max": row["pk_max"]},
            "tramo": {"inicio": row["town_start"], "fin": row["town_end"]},
            "sentido": row["direction_raw"] or row["direction"],
            "franja_horaria": tw,
            "dias_afecta": hits,
            "confidence": row["confidence"],
            "restriction_type": row["restriction_type"],
            "source_scope": row["source_scope"],
            "source_annex": row["source_annex"],
            "source_block": row["source_block"],
            "date_rule": rule,
        })
    return out

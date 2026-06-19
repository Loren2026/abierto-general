from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Madrid")
GENERAL_HEAVY_CALENDAR_STATUS = "INFORMATIVO_NO_VALIDADO"
GENERAL_HEAVY_CALENDAR_SOURCE = "Regla mínima provisional: pesados >7.500 kg en domingos/festivos; pendiente de patrón oro DGT/autonómicas"
NATIONAL_HOLIDAYS_2026 = {
    "2026-01-01",
    "2026-01-06",
    "2026-04-03",
    "2026-05-01",
    "2026-08-15",
    "2026-10-12",
    "2026-11-01",
    "2026-12-06",
    "2026-12-08",
    "2026-12-25",
}


def _parse_departure(fecha_salida: str, hora_salida: str) -> datetime:
    return datetime.fromisoformat(f"{fecha_salida}T{hora_salida}:00").replace(tzinfo=TZ)


def _touches_general_heavy_window(start: datetime, eta_minutes: int | None) -> bool:
    end = start + timedelta(minutes=eta_minutes or 0)
    cursor = start
    while cursor <= end:
        day = cursor.date().isoformat()
        if cursor.weekday() == 6 or day in NATIONAL_HOLIDAYS_2026:
            return True
        cursor += timedelta(hours=1)
    return False


def general_heavy_vehicle_calendar_warnings(fecha_salida: str, hora_salida: str, eta_minutes: int | None, *, cargo_type: str, mass_kg: int) -> list[str]:
    """Aviso informativo para mercancía general pesada; no bloquea ni sustituye patrón oro DGT."""
    if str(cargo_type).lower() != "general" or int(mass_kg or 0) <= 7500:
        return []
    start = _parse_departure(fecha_salida, hora_salida)
    if not _touches_general_heavy_window(start, eta_minutes):
        return []
    return [
        "Calendario general de pesados en modo informativo: trayecto con vehículo >7.500 kg en domingo/festivo; revisar restricciones DGT/autonómicas antes de circular. No bloquea rutas hasta validar patrón oro.",
        f"Fuente/estado: {GENERAL_HEAVY_CALENDAR_SOURCE}.",
    ]

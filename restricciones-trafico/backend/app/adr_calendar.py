from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Madrid")
ADR_CALENDAR_GT_STATUS = "NO VALIDADO"
ADR_CALENDAR_SOURCE = "BOE-A-2026-1255, B.2.1: ADR sujeto a Anexo V y, si >7.500 kg, también Anexo II"


def parse_departure(fecha_salida: str, hora_salida: str) -> datetime:
    return datetime.fromisoformat(f"{fecha_salida}T{hora_salida}:00").replace(tzinfo=TZ)


def adr_calendar_warnings(fecha_salida: str, hora_salida: str, eta_minutes: int | None = None) -> list[str]:
    """Avisos informativos ADR, sin bloquear.

    Patrón oro pequeño pendiente con Claude: Anexo V apartado 1.º/2.º A y autonómicas.
    Regla provisional conservadora: advertir en domingos/festivos tarde y fines de semana,
    porque B.2.1 remite al calendario/tramos del Anexo V.
    """
    start = parse_departure(fecha_salida, hora_salida)
    end = start + timedelta(minutes=eta_minutes or 0)
    warnings = [
        "ADR/RIMP 2026 en modo informativo: calendario ADR pendiente de patrón oro; no bloquea rutas.",
        "Fuente DGT: B.2.1 remite al Anexo V para mercancías peligrosas y, si supera 7.500 kg, también al Anexo II.",
    ]
    cursor = start
    while cursor <= end:
        if cursor.weekday() == 6 and cursor.hour >= 15:
            warnings.append("Posible franja ADR restringida: domingo de 15:00 a 24:00. Revisar Anexo V/autonómicas antes de circular.")
            break
        cursor += timedelta(hours=1)
    if start.weekday() in (4, 5, 6):
        warnings.append("Salida ADR en fin de semana: revisar restricciones de calendario DGT/autonómicas aplicables.")
    return warnings

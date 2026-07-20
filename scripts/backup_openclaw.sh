#!/bin/bash
set -euo pipefail

FECHA=$(date +%Y%m%d_%H%M%S)
CONTENEDOR="openclaw-2ns9-openclaw-1"
DESTINO="gdrive:OpenClaw-Backups"
TMPFILE="/tmp/backup_${FECHA}.tar.gz"
MIN_SIZE_BYTES=100000
KEEP_COPIES=5

cleanup() {
  rm -f "$TMPFILE"
}
trap cleanup EXIT

docker exec "$CONTENEDOR" tar -czf - -C /data .openclaw > "$TMPFILE"

SIZE=$(stat -c%s "$TMPFILE")
if [ "$SIZE" -lt "$MIN_SIZE_BYTES" ]; then
  echo "ERROR: backup demasiado pequeño ($SIZE bytes). Abortado."
  exit 1
fi

if ! rclone copy "$TMPFILE" "$DESTINO/"; then
  echo "ERROR: fallo al subir backup a Google Drive. No se rota remoto."
  exit 1
fi

REMOTE_SIZE=$(rclone size "$DESTINO/$(basename "$TMPFILE")" --json | python3 -c 'import sys,json; print(json.load(sys.stdin).get("bytes", 0))')
if [ "$REMOTE_SIZE" -lt "$MIN_SIZE_BYTES" ]; then
  echo "ERROR: backup remoto no verificable ($REMOTE_SIZE bytes). No se rota remoto."
  exit 1
fi

BACKUPS_DRIVE=$(rclone lsf "$DESTINO/" --files-only | grep '^backup_.*\.tar\.gz$' | sort -r | tail -n +$((KEEP_COPIES + 1)) || true)
for f in $BACKUPS_DRIVE; do
  rclone deletefile "$DESTINO/$f" --drive-use-trash=false
done

echo "Backup completado: $FECHA ($SIZE bytes). Remoto verificado: $REMOTE_SIZE bytes"

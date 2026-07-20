#!/bin/bash
# Backup Servidor B
# Origen: /docker/ | Excluye: openclaw-2ns9 (ya cubierto por Backup A)
# Cobertura adicional: /data/ y /opt/ con volcados consistentes de SQLite
set -euo pipefail

LOG_FILE="/var/log/backup_server.log"
REMOTE="gdrive:Servidor-Backups"
BACKUP_NAME="backup-servidor-$(date +%Y%m%d-%H%M%S).tar.gz"
TMP_FILE="/tmp/${BACKUP_NAME}"
TMP_TAR="/tmp/${BACKUP_NAME%.gz}"
SQLITE_DUMP_ROOT="$(mktemp -d /tmp/backup-servidor-sqlite.XXXXXX)"
SQLITE_DUMP_DIR="${SQLITE_DUMP_ROOT}/sqlite-dumps"
DOCKER_TAR_LIST="$(mktemp /tmp/backup-servidor-docker-list.XXXXXX)"
ROOT_TAR_LIST="$(mktemp /tmp/backup-servidor-root-list.XXXXXX)"
# Umbral anti-catástrofe: el backup real medido ronda 25 MB tras exclusiones;
# 10 MB permite variaciones legítimas a la baja sin aceptar un tar vacío.
MIN_SIZE_BYTES=10000000
KEEP_COPIES=7

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

cleanup() {
 rm -f "$TMP_FILE"
 rm -f "$TMP_TAR"
 rm -f "$DOCKER_TAR_LIST" "$ROOT_TAR_LIST"
 if [ -n "${SQLITE_DUMP_ROOT:-}" ] && [ -d "$SQLITE_DUMP_ROOT" ]; then rm -rf "$SQLITE_DUMP_ROOT"; fi
}

trap cleanup EXIT

find_pruned() {
 local root="$1"
 find "$root" \
  \( -path '/docker/openclaw-2ns9' -o -path '/docker/openclaw-2ns9/*' \
     -o -name '.git' -o -name 'node_modules' -o -name 'build' \
     -o -name '.dart_tool' -o -name '.flutter-plugins' -o -name '.flutter-plugins-dependencies' \) -prune \
  -o \( -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \
     -o -name '*.sqlite-wal' -o -name '*.sqlite-shm' \
     -o -name '*.sqlite3-wal' -o -name '*.sqlite3-shm' \
     -o -name '*.db-wal' -o -name '*.db-shm' \) \) -prune \
  -o -print0
}

dump_sqlite_databases() {
 mkdir -p "$SQLITE_DUMP_DIR"

 local roots=()
 [ -d /docker ] && roots+=(/docker)
 [ -d /data ] && roots+=(/data)
 [ -d /opt ] && roots+=(/opt)

 if [ "${#roots[@]}" -eq 0 ]; then
  log "AVISO: no existen /docker, /data ni /opt; no hay búsqueda de SQLite"
  return 0
 fi

 log "Localizando bases SQLite bajo /docker, /data y /opt"

 local found=0
 local ok=0
 local failed=0
 local db_path
 while IFS= read -r -d '' db_path; do
  found=$((found + 1))

  local dump_path="${SQLITE_DUMP_DIR}${db_path}.backup"
  local dump_dir
  dump_dir="$(dirname "$dump_path")"
  mkdir -p "$dump_dir"

  log "Volcando SQLite: $db_path -> ${dump_path#${SQLITE_DUMP_ROOT}/}"
  if sqlite3 "$db_path" ".backup '$dump_path'"; then
   ok=$((ok + 1))
  else
   failed=$((failed + 1))
   log "ERROR: fallo al volcar SQLite: $db_path. Se continúa con el resto."
   rm -f "$dump_path"
  fi
 done < <(find "${roots[@]}" \
  \( -path '/docker/openclaw-2ns9' -o -path '/docker/openclaw-2ns9/*' \
     -o -name '.git' -o -name 'node_modules' -o -name 'build' \
     -o -name '.dart_tool' -o -name '.flutter-plugins' -o -name '.flutter-plugins-dependencies' \) -prune \
  -o \( -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \) -print0 \) 2>>"$LOG_FILE" || true)

 log "SQLite localizados: ${found}; volcados OK: ${ok}; fallidos: ${failed}"
}

build_tar_lists() {
 : > "$DOCKER_TAR_LIST"
 : > "$ROOT_TAR_LIST"

 local entry
 while IFS= read -r -d '' entry; do
  if [ "$entry" != /docker ]; then
   printf '%s\0' "${entry#/docker/}" >> "$DOCKER_TAR_LIST"
  fi
 done < <(find_pruned /docker 2>>"$LOG_FILE" || true)

 for root in /data /opt; do
  if [ -d "$root" ]; then
   while IFS= read -r -d '' entry; do
    printf '%s\0' "${entry#/}" >> "$ROOT_TAR_LIST"
   done < <(find_pruned "$root" 2>>"$LOG_FILE" || true)
  fi
 done
}

log "=== INICIO Backup Servidor B ==="

if [ ! -d /docker ]; then log "ERROR: /docker no existe"; exit 1; fi

if [ ! -d /data ]; then log "AVISO: /data no existe; no se incluirá en el backup"; fi
if [ ! -d /opt ]; then log "AVISO: /opt no existe; no se incluirá en el backup"; fi

dump_sqlite_databases

log "Preparando lista explícita de ficheros para /docker, /data y /opt"
build_tar_lists

log "Creando tar.gz de /docker excluyendo OpenClaw y artefactos; incluyendo /data, /opt y volcados SQLite"

if [ ! -s "$DOCKER_TAR_LIST" ]; then log "ERROR: lista de /docker vacía. Abortando."; exit 1; fi

tar -cf "$TMP_TAR" -C /docker --no-recursion --null -T "$DOCKER_TAR_LIST"

if [ -s "$ROOT_TAR_LIST" ]; then
 tar -rf "$TMP_TAR" -C / --no-recursion --null -T "$ROOT_TAR_LIST"
fi

if [ -d "$SQLITE_DUMP_DIR" ]; then
 tar -rf "$TMP_TAR" -C "$SQLITE_DUMP_ROOT" sqlite-dumps
fi

gzip -f "$TMP_TAR"

SIZE_BYTES=$(stat -c%s "$TMP_FILE")
log "Tamaño generado: ${SIZE_BYTES} bytes"
if [ "$SIZE_BYTES" -lt "$MIN_SIZE_BYTES" ]; then log "ERROR: backup demasiado pequeño (${SIZE_BYTES} bytes). Abortando."; exit 1; fi

log "Subiendo a Google Drive"
rclone copy "$TMP_FILE" "$REMOTE/"

log "Verificando subida remota"
REMOTE_SIZE=$(rclone size "$REMOTE/$(basename "$TMP_FILE")" --json | python3 -c 'import sys,json; print(json.load(sys.stdin).get("bytes", 0))')
if [ "$REMOTE_SIZE" -lt "$MIN_SIZE_BYTES" ]; then log "ERROR: backup remoto no verificable (${REMOTE_SIZE} bytes)"; exit 1; fi
log "Backup remoto verificado: ${REMOTE_SIZE} bytes"

log "Rotacion: mantener ${KEEP_COPIES} copias"
OLD_FILES=$(rclone lsf "$REMOTE/" --files-only | grep '^backup-servidor-.*\.tar\.gz$' | sort -r | tail -n +$((KEEP_COPIES + 1)) || true)
if [ -n "$OLD_FILES" ]; then
 while read -r OLD_FILE; do
  if [ -n "$OLD_FILE" ]; then log "Eliminando copia antigua: $OLD_FILE"; rclone deletefile "$REMOTE/$OLD_FILE" --drive-use-trash=false; fi
 done <<< "$OLD_FILES"
fi

log "=== FIN OK Backup Servidor B ==="

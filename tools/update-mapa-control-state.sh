#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

usage() {
  cat >&2 <<'EOF'
Usage:
  tools/update-mapa-control-state.sh NEW_STATE_JSON

Reads a complete replacement JSON document from NEW_STATE_JSON.

Production defaults:
  live state: /data/mapa-control/estado.json
  repo mirror: data/mapa-control/estado.json, relative to this repo
  backups:    /data/mapa-control/backups

Dry-run/testing overrides:
  MAPA_CONTROL_LIVE_STATE_PATH=/path/to/live/estado.json
  MAPA_CONTROL_REPO_STATE_PATH=/path/to/repo/estado.json
  MAPA_CONTROL_BACKUP_DIR=/path/to/backups
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

sha256() {
  sha256sum "$1" | awk '{print $1}'
}

require_estado_path() {
  local label="$1"
  local path_value="$2"

  [[ -n "$path_value" ]] || fail "$label path is empty"
  [[ "$(basename -- "$path_value")" == "estado.json" ]] || fail "$label must end in estado.json: $path_value"
}

copy_json_preserving_metadata() {
  local source_json="$1"
  local destination_tmp="$2"
  local reference_file="$3"

  cp -- "$source_json" "$destination_tmp"
  chmod --reference="$reference_file" "$destination_tmp"
  chown --reference="$reference_file" "$destination_tmp" 2>/dev/null || true
  jq empty "$destination_tmp"
}

rotate_backups() {
  local backup_dir="$1"
  local keep_count=10

  mapfile -t old_backups < <(
    find "$backup_dir" -maxdepth 1 -type f -name 'estado-*-pre.json' -printf '%T@ %p\n' \
      | sort -rn \
      | tail -n "+$((keep_count + 1))" \
      | cut -d' ' -f2-
  )

  for old_backup in "${old_backups[@]}"; do
    rm -f -- "$old_backup"
    echo "Backup antiguo rotado: $old_backup"
  done
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

[[ $# -eq 1 ]] || {
  usage
  exit 2
}

new_state_path="$1"
[[ -f "$new_state_path" ]] || fail "new JSON file not found: $new_state_path"
[[ -r "$new_state_path" ]] || fail "new JSON file is not readable: $new_state_path"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "$script_dir/.." && pwd -P)"

live_state_path="${MAPA_CONTROL_LIVE_STATE_PATH:-/data/mapa-control/estado.json}"
repo_state_path="${MAPA_CONTROL_REPO_STATE_PATH:-$repo_root/data/mapa-control/estado.json}"
backup_dir="${MAPA_CONTROL_BACKUP_DIR:-$(dirname -- "$live_state_path")/backups}"

require_estado_path "live state" "$live_state_path"
require_estado_path "repo mirror" "$repo_state_path"

live_dir="$(dirname -- "$live_state_path")"
repo_dir="$(dirname -- "$repo_state_path")"

[[ -f "$live_state_path" ]] || fail "live estado.json not found: $live_state_path"
[[ -r "$live_state_path" ]] || fail "live estado.json is not readable: $live_state_path"
[[ -w "$live_state_path" ]] || fail "live estado.json is not writable: $live_state_path"
[[ -d "$live_dir" ]] || fail "live directory not found: $live_dir"
[[ -w "$live_dir" ]] || fail "live directory is not writable: $live_dir"

[[ -f "$repo_state_path" ]] || fail "repo mirror estado.json not found: $repo_state_path"
[[ -r "$repo_state_path" ]] || fail "repo mirror estado.json is not readable: $repo_state_path"
[[ -w "$repo_state_path" ]] || fail "repo mirror estado.json is not writable: $repo_state_path"
[[ -d "$repo_dir" ]] || fail "repo mirror directory not found: $repo_dir"
[[ -w "$repo_dir" ]] || fail "repo mirror directory is not writable: $repo_dir"

mkdir -p -- "$backup_dir"
[[ -d "$backup_dir" ]] || fail "backup directory not found: $backup_dir"
[[ -w "$backup_dir" ]] || fail "backup directory is not writable: $backup_dir"

for _ in 1 2 3 4 5; do
  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup_path="$backup_dir/estado-${timestamp}-pre.json"
  [[ ! -e "$backup_path" ]] && break
  sleep 1
done

[[ ! -e "$backup_path" ]] || fail "backup path already exists after retries: $backup_path"

live_tmp=""
repo_tmp=""
rollback_tmp=""
production_replaced=0
completed=0

cleanup() {
  rm -f -- ${live_tmp:+"$live_tmp"} ${repo_tmp:+"$repo_tmp"} ${rollback_tmp:+"$rollback_tmp"}
}

rollback_if_needed() {
  local exit_code=$?

  if [[ "$completed" -eq 0 && "$production_replaced" -eq 1 ]]; then
    echo "Fallo tras escribir produccion; restaurando backup previo..." >&2
    rollback_tmp="$(mktemp "${live_dir}/.estado.json.rollback.XXXXXX")"
    cp -p -- "$backup_path" "$rollback_tmp"
    mv -f -- "$rollback_tmp" "$live_state_path"
    echo "Produccion restaurada desde: $backup_path" >&2
  fi

  cleanup
  exit "$exit_code"
}

trap rollback_if_needed EXIT

cp -p -- "$live_state_path" "$backup_path"
backup_sha="$(sha256 "$backup_path")"
echo "Backup previo: $backup_path"
echo "SHA256 backup: $backup_sha"

echo "Validando JSON nuevo..."
jq empty "$new_state_path"

rotate_backups "$backup_dir"

live_tmp="$(mktemp "${live_dir}/.estado.json.tmp.XXXXXX")"
repo_tmp="$(mktemp "${repo_dir}/.estado.json.tmp.XXXXXX")"

copy_json_preserving_metadata "$new_state_path" "$live_tmp" "$live_state_path"
copy_json_preserving_metadata "$new_state_path" "$repo_tmp" "$repo_state_path"

mv -f -- "$live_tmp" "$live_state_path"
live_tmp=""
production_replaced=1

mv -f -- "$repo_tmp" "$repo_state_path"
repo_tmp=""

jq empty "$live_state_path"
jq empty "$repo_state_path"

live_sha="$(sha256 "$live_state_path")"
repo_sha="$(sha256 "$repo_state_path")"

echo "SHA256 ruta viva: $live_sha  $live_state_path"
echo "SHA256 mirror repo: $repo_sha  $repo_state_path"

[[ "$live_sha" == "$repo_sha" ]] || fail "SHA mismatch between live state and repo mirror"

completed=1
trap - EXIT
cleanup

echo "OK: estado.json actualizado atomically en ruta viva y mirror repo; SHA coincidente."

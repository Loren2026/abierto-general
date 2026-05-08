#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATUS_FILE="${STATUS_FILE:-$WORKSPACE_ROOT/model-status.json}"
LOG_FILE="${LOG_FILE:-$WORKSPACE_ROOT/model-watch.log}"
PREFERRED_MODEL="openai-codex/gpt-5.4"
FREE_FALLBACK_MODEL="zai/glm-4.7"
PAID_FALLBACK_MODEL="zai/glm-4.7-paid"

mkdir -p "$(dirname "$STATUS_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

if [[ ! -f "$STATUS_FILE" ]]; then
  cat > "$STATUS_FILE" <<JSON
{
  "lastCheckedAt": null,
  "currentPreferredModel": "$PREFERRED_MODEL",
  "fallbackLevel": 1,
  "lastNotifiedModel": null,
  "lastChangeReason": null,
  "notificationPending": false,
  "notificationMessage": null
}
JSON
fi

NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
CURRENT_MODEL="${CURRENT_MODEL:-$PREFERRED_MODEL}"
TARGET_MODEL="$CURRENT_MODEL"
FALLBACK_LEVEL=1
CHANGE_REASON="No change"
NOTIFICATION_PENDING=false
NOTIFICATION_MESSAGE=""

# TODO: Replace env-driven detection with a real provider/usage probe when available.
GPT_54_AVAILABLE="${GPT_54_AVAILABLE:-true}"
GLM_FREE_AVAILABLE="${GLM_FREE_AVAILABLE:-false}"
ALLOW_GLM_PAID="${ALLOW_GLM_PAID:-false}"

if [[ "$GPT_54_AVAILABLE" == "true" ]]; then
  TARGET_MODEL="$PREFERRED_MODEL"
  FALLBACK_LEVEL=1
  CHANGE_REASON="GPT 5.4 available"
elif [[ "$GLM_FREE_AVAILABLE" == "true" ]]; then
  TARGET_MODEL="$FREE_FALLBACK_MODEL"
  FALLBACK_LEVEL=2
  CHANGE_REASON="GPT 5.4 unavailable, using free GLM fallback"
elif [[ "$ALLOW_GLM_PAID" == "true" ]]; then
  TARGET_MODEL="$PAID_FALLBACK_MODEL"
  FALLBACK_LEVEL=3
  CHANGE_REASON="No free alternative available, using paid GLM fallback"
else
  TARGET_MODEL="$CURRENT_MODEL"
  FALLBACK_LEVEL=99
  CHANGE_REASON="No allowed model change available"
fi

if [[ "$TARGET_MODEL" != "$CURRENT_MODEL" ]]; then
  NOTIFICATION_PENDING=true
  NOTIFICATION_MESSAGE="Modelo activo cambiado a $TARGET_MODEL. Motivo: $CHANGE_REASON"
fi

python3 - <<PY
import json
from pathlib import Path
status_path = Path(${STATUS_FILE@Q})
status = json.loads(status_path.read_text())
status.update({
  "lastCheckedAt": ${NOW_UTC@Q},
  "currentPreferredModel": ${TARGET_MODEL@Q},
  "fallbackLevel": ${FALLBACK_LEVEL},
  "lastChangeReason": ${CHANGE_REASON@Q},
  "notificationPending": ${'True' if False else 'False'}
})
status["notificationPending"] = ${'True' if False else 'False'}
status["notificationPending"] = ${NOTIFICATION_PENDING@Q}.lower() == 'true'
status["notificationMessage"] = ${NOTIFICATION_MESSAGE@Q} or None
if status["notificationPending"]:
  status["lastNotifiedModel"] = status.get("lastNotifiedModel")
status_path.write_text(json.dumps(status, indent=2) + "\n")
PY

echo "[$NOW_UTC] current=$CURRENT_MODEL target=$TARGET_MODEL fallbackLevel=$FALLBACK_LEVEL reason=$CHANGE_REASON" >> "$LOG_FILE"

if [[ "$NOTIFICATION_PENDING" == "true" ]]; then
  echo "[$NOW_UTC] notification-pending: $NOTIFICATION_MESSAGE" >> "$LOG_FILE"
fi

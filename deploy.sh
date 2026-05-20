#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "==> Repo: $REPO_DIR"
echo "==> Pull último código"
git pull --rebase

echo "==> Build frontend y API"
docker compose build inteligencialoren-web inteligencialoren-api

echo "==> Levantar servicios"
docker compose up -d inteligencialoren-web inteligencialoren-api

echo "==> Estado actual"
docker compose ps

echo "==> Verificación rápida sugerida"
echo "- https://inteligencialoren.com"
echo "- https://panel.inteligencialoren.com"
echo "- https://panel.inteligencialoren.com/api/projects"

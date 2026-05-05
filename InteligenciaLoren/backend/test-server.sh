#!/bin/bash

cd /data/.openclaw/workspace/InteligenciaLoren/backend
PORT=3333 node src/index.js &
SERVER_PID=$!

echo "Servidor iniciado con PID: $SERVER_PID"
sleep 3

echo "Haciendo petición a /api/health..."
curl -s http://localhost:3333/api/health

echo ""
echo "Terminando servidor..."
kill $SERVER_PID 2>/dev/null || true

echo "Prueba completada."

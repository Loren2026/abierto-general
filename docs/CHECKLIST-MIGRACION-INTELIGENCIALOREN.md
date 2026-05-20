# Checklist de migración, InteligenciaLoren unificado

## Confirmaciones previas
- [ ] Confirmar nombre real de la red Docker de Traefik en el VPS con `docker network ls | grep -i traefik`
- [ ] Si la red no es `traefik-public`, actualizar `docker-compose.yml`
- [ ] Confirmar que `api/.env` existe en el VPS y tiene todas las variables necesarias
- [ ] Confirmado en código: `api/Dockerfile` expone puerto `3000`
- [ ] Confirmado en código: `web/Dockerfile` sirve nginx en puerto `80`

## Backup operativo mínimo
- [ ] Anotar nombres de contenedores frontend/backend actuales
- [ ] Guardar salida de `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'`
- [ ] Guardar salida de `docker inspect <contenedor_viejo>` de los frontends actuales

## Build y despliegue
- [ ] Subir al VPS `docker-compose.yml`
- [ ] Subir al VPS `deploy.sh`
- [ ] Dar permisos: `chmod +x deploy.sh`
- [ ] Ejecutar `docker compose build inteligencialoren-web inteligencialoren-api`
- [ ] Parar y retirar contenedores legacy que compiten por las mismas rules de Traefik
- [ ] Ejecutar `docker compose up -d inteligencialoren-web inteligencialoren-api`

## Verificación funcional
- [ ] `https://inteligencialoren.com` carga la landing correcta
- [ ] `https://www.inteligencialoren.com` responde correctamente
- [ ] `https://panel.inteligencialoren.com` carga el mismo bundle frontend actualizado
- [ ] `https://panel.inteligencialoren.com/api/projects` responde desde API
- [ ] El bundle servido ya usa `/api/validate-code` sin slug
- [ ] Login admin funciona
- [ ] Validación de código GestActas funciona
- [ ] Redirección a `gestactas.inteligencialoren.com` funciona

## Limpieza
- [ ] Eliminar despliegue legacy de `InteligenciaLoren/landing` de producción
- [ ] Eliminar cualquier `docker run` manual documentado para frontends viejos
- [ ] Dejar `web/` como única fuente frontend oficial
- [ ] Documentar que el despliegue estándar es `./deploy.sh`

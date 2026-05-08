# Operación de modelos

## Prioridad obligatoria

1. `openai-codex/gpt-5.4`
2. `zai/glm-4.7` gratis, si está disponible
3. `zai/glm-4.7` de pago, solo si no hay alternativa

## Aviso obligatorio

Cada vez que cambie el modelo activo, se debe avisar por Telegram a Loren indicando:

- modelo actual
- motivo del cambio

La notificación solo debe enviarse cuando haya un cambio real, no en cada comprobación.

## Comprobación periódica

La verificación debe ejecutarse cada 2 horas mediante cron llamando a:

```bash
/data/.openclaw/workspace/scripts/check-model-priority.sh
```

## Estado persistente

El estado de la última comprobación se guarda en:

```text
/data/.openclaw/workspace/model-status.json
```

## Logging

El log operativo se guarda en:

```text
/data/.openclaw/workspace/model-watch.log
```

## Nota actual

El script deja `notificationPending=true` y un mensaje en `model-status.json` cuando detecta un cambio de modelo. La entrega efectiva por Telegram debe conectarse al mecanismo de mensajería disponible en el entorno donde se ejecute.

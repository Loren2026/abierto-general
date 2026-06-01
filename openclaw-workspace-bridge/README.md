# openclaw-workspace-bridge

Internal-only bridge for Workspace Chat F2.

Purpose:

```text
inteligencialoren-api -> openclaw-workspace-bridge -> OpenClaw Gateway loopback
```

The bridge must run on the OpenClaw side where `ws://127.0.0.1:18789` reaches the Gateway. It exposes only:

- `GET /health`
- `POST /workspace-chat/send`

Required env:

```text
WORKSPACE_BRIDGE_TOKEN=...
OPENCLAW_GATEWAY_TOKEN=...
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
PORT=8789
```

Do not expose this service publicly. It is intended for Docker/internal network only.

#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker rm -f livekit-dev >/dev/null 2>&1 || true
docker compose -f "$ROOT_DIR/docker-compose.media.yml" up -d

echo "LiveKit media stack listo:"
echo "  WebSocket: ws://localhost:7880"
echo "  RTMP OBS:  rtmp://localhost:1935/live"
echo "  WHIP:      http://localhost:8080/whip"

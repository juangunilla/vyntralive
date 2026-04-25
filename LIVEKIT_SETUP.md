# LiveKit setup local

## Opción 1: Docker (Recomendado)

```bash
docker run --rm -it --name livekit-dev -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_API_KEY=devkey \
  -e LIVEKIT_API_SECRET=secret \
  livekit/livekit-server:latest --dev --bind 0.0.0.0
```

## Opción 1B: Docker con OBS local

```bash
./start-media.sh
```

Esto levanta:

- `Redis`
- `LiveKit Server`
- `LiveKit Ingress`

Y deja OBS listo para usar con:

- `Server`: `rtmp://localhost:1935/live`
- `Stream Key`: lo genera la app por transmisión

## Opción 2: Desde source

```bash
git clone https://github.com/livekit/livekit-server.git
cd livekit-server
make build
./bin/livekit-server --dev
```

## Opción 3: Usar servicio cloud gratis

Ve a https://cloud.livekit.io, regístrate, obtén tus credenciales y actualiza .env:

```env
LIVEKIT_URL=wss://your-room.livekit.cloud
LIVEKIT_API_KEY=tu_api_key
LIVEKIT_API_SECRET=tu_api_secret
LIVEKIT_INGRESS_INPUT=RTMP
```

---

## Verificar que anda

```bash
docker logs livekit-dev --tail 20
# Deberías ver bindAddresses: ["0.0.0.0"]
```

## En el proyecto

Después de correr LiveKit, sigue los pasos:

```bash
cd backend && npm install && npm run dev
cd ../frontend && npm install && npm run dev
```

Luego crea una transmisión en `http://localhost:3000/streams` y haz clic en "Iniciar transmisión".

## OBS

La app puede generar `Server` y `Stream Key` para OBS cuando LiveKit tiene `Ingress` habilitado.

- Con LiveKit Cloud suele venir disponible directamente.
- Con self-hosted, `livekit-server --dev` no alcanza: debes desplegar también `LiveKit Ingress`.
- En este repo ya quedó preparado un stack local con `./start-media.sh`.

# ⚡ Quick Start

## Arrancar en 5 minutos

### 1️⃣ Inicia LiveKit (elige uno)

**Con Docker:**
```bash
docker run --rm -it --name livekit-dev -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_API_KEY=devkey \
  -e LIVEKIT_API_SECRET=secret \
  livekit/livekit-server:latest --dev --bind 0.0.0.0
```

**Con soporte OBS local:**
```bash
./start-media.sh
```

Esto levanta `Redis + LiveKit + Ingress` y deja RTMP listo en `rtmp://localhost:1935/live`.

**O usa cloud gratis:** https://cloud.livekit.io

### 2️⃣ Backend

```bash
cd backend
npm install
npm run dev
```

Debería mostrar: `Backend running on http://localhost:4000`

### 3️⃣ Frontend (otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Debería mostrar: `ready started server on 0.0.0.0:3000`

### 4️⃣ Usa la app

Abre: **http://localhost:3000**

1. Regístrate con rol "Creador"
2. Ve a "Transmisiones"
3. Elige `Navegador` para emitir desde la web o `OBS` para emitir desde OBS sin duplicar video
4. Haz clic en "Iniciar transmisión"
5. Si usas `OBS`, abre `Conectar con OBS` y copia `Server` y `Stream Key`
6. ¡Transmitiendo en vivo! 🎥

---

## 🔧 Troubleshooting

**"MongoDB connection error"**
- Asegúrate de que MongoDB esté corriendo o usa una URL de Atlas

**"WebSocket connection failed"**
- LiveKit no está corriendo o quedó escuchando solo dentro del contenedor. Inícialo con `--bind 0.0.0.0`.

**"No se pudo preparar la conexión OBS"**
- Levanta el stack local con `./start-media.sh`. Si usas tu propia infraestructura, necesitas `Redis + LiveKit Ingress`.

**"Permission denied" para cámara**
- Los navegadores necesitan HTTPS en producción. Localmente debería permitir.

---

## 📚 Próximos pasos

- [Integración completa](./README.md)
- [Setup de LiveKit](./LIVEKIT_SETUP.md)
- [Deploy a VPS](./README.md#deploy)

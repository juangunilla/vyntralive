# 🚀 Plataforma de Transmisiones en Vivo

Una plataforma completa de streaming en vivo construida con Next.js, Express, MongoDB y LiveKit. Incluye chat en tiempo real, autenticación JWT y una interfaz moderna y responsive.

## ✨ Características

- 🎥 **Transmisiones en vivo** con LiveKit
- 💬 **Chat en tiempo real** con Socket.IO
- 🔐 **Autenticación segura** con JWT
- 👥 **Sistema de usuarios** con roles (Usuario/Creador/Admin)
- 📱 **Interfaz responsive** y moderna
- 🐳 **Deployment con Docker** listo para producción
- ⚡ **Rendimiento optimizado** con Nginx reverse proxy

## 🛠️ Tecnologías

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Node.js, Express.js, Socket.IO
- **Base de datos**: MongoDB con Mongoose
- **Streaming**: LiveKit SDK
- **Autenticación**: JWT + bcryptjs
- **Deployment**: Docker, Docker Compose, Nginx

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker y Docker Compose
- Node.js 18+ (para desarrollo local)
- Cuenta en [LiveKit Cloud](https://cloud.livekit.io)

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd live-streaming-platform
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus valores reales:

```env
# Base de datos
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=tu_password_seguro
MONGO_DATABASE=live_streaming

# JWT
JWT_SECRET=tu_jwt_secret_largo_y_aleatorio

# LiveKit (obtén estos de https://cloud.livekit.io)
LIVEKIT_API_KEY=tu_api_key
LIVEKIT_API_SECRET=tu_api_secret
LIVEKIT_URL=wss://tu-servidor.livekit.cloud
LIVEKIT_INGRESS_INPUT=RTMP

# URLs de la aplicación
FRONTEND_URL=https://tudominio.com
NEXT_PUBLIC_BACKEND_URL=https://api.tudominio.com
NEXT_PUBLIC_LIVEKIT_URL=wss://tu-servidor.livekit.cloud
```

### 3. Desplegar con Docker

```bash
# Para desarrollo
./deploy.sh development

# Para producción
./deploy.sh production
```

### 4. Acceder a la aplicación

- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:4000
- **MongoDB**: localhost:27017

## 🏗️ Desarrollo Local

### LiveKit local

```bash
docker run --rm -it --name livekit-dev -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_API_KEY=devkey \
  -e LIVEKIT_API_SECRET=secret \
  livekit/livekit-server:latest --dev --bind 0.0.0.0
```

Nota: este modo local sirve para publicar desde el navegador. Para usar OBS necesitas LiveKit Cloud o un despliegue self-hosted con Ingress habilitado.

### LiveKit local con OBS

```bash
./start-media.sh
```

Esto levanta `Redis + LiveKit + Ingress` para desarrollo local y deja RTMP disponible en `rtmp://localhost:1935/live`.

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Base de datos

Asegúrate de tener MongoDB corriendo localmente o usa Docker:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:7-jammy
```

## 🎛️ Conectar OBS

El proyecto ya puede generar credenciales para OBS por transmisión, pero depende de que tu proyecto LiveKit tenga `Ingress` disponible.

- En LiveKit Cloud funciona sin infraestructura adicional.
- En self-hosted necesitas desplegar `LiveKit Ingress` y configurarlo en tu servidor LiveKit.
- En este repo puedes levantar el stack local completo con `./start-media.sh`.
- La app crea un ingreso `RTMP` por defecto. Puedes cambiarlo con `LIVEKIT_INGRESS_INPUT=WHIP`.

Flujo en la app:

1. Inicia una transmisión como creador.
2. Elige el modo de emisión:
   `Navegador` publica cámara/micrófono desde la web.
   `OBS` reserva la sala para la señal que entra desde OBS y evita duplicar video desde el navegador.
3. Si elegiste `OBS`, en la tarjeta de tu transmisión haz clic en `Conectar con OBS`.
4. Copia `Server` y `Stream Key`.
5. En OBS: `Settings` → `Stream` → `Service: Custom`.
6. Pega los valores y comienza a transmitir.

## 📁 Estructura del Proyecto

```
live-streaming-platform/
├── backend/                 # API REST con Express
│   ├── controllers/         # Controladores de rutas
│   ├── models/             # Modelos de MongoDB
│   ├── routes/             # Definición de rutas
│   ├── middleware/         # Middleware personalizado
│   ├── services/           # Servicios (LiveKit, etc.)
│   └── server.js           # Punto de entrada
├── frontend/               # Aplicación Next.js
│   ├── app/                # App Router
│   ├── components/         # Componentes React
│   ├── lib/                # Utilidades
│   └── public/             # Archivos estáticos
├── nginx/                  # Configuración de Nginx
├── docker-compose.yml      # Orquestación de contenedores
├── deploy.sh              # Script de deployment
└── .env.example           # Variables de entorno
```

## 🔧 Configuración de Producción

### 1. SSL/TLS con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot

# Obtener certificado
sudo certbot certonly --standalone -d tudominio.com

# Copiar certificados a nginx/ssl/
sudo cp /etc/letsencrypt/live/tudominio.com/fullchain.pem ./nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/tudominio.com/privkey.pem ./nginx/ssl/key.pem
```

### 2. Configurar Nginx para SSL

Edita `nginx/nginx.conf` y descomenta la sección del servidor SSL.

### 3. Variables de entorno de producción

Asegúrate de configurar estas variables en producción:

```env
FRONTEND_URL=https://tudominio.com
NEXT_PUBLIC_BACKEND_URL=https://api.tudominio.com
```

## 📊 Monitoreo y Logs

### Ver logs de servicios

```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Ver estado de contenedores

```bash
docker-compose ps
```

### Health checks

```bash
# Backend
curl http://localhost:4000/health

# Frontend
curl http://localhost:3000

# MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

## 🔒 Seguridad

- **Autenticación JWT** con expiración configurable
- **Rate limiting** en endpoints de API
- **Headers de seguridad** en Nginx
- **Variables de entorno** para secrets sensibles
- **Contenedores no-root** en producción

## 🚀 Deployment en VPS

### 1. Preparar el servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Configurar firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 3. Desplegar

```bash
# Clonar repositorio
git clone <repository-url>
cd live-streaming-platform

# Configurar variables de entorno
cp .env.example .env
nano .env  # Editar con valores reales

# Desplegar
./deploy.sh production
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa los [issues](https://github.com/tu-usuario/live-streaming-platform/issues) existentes
2. Crea un nuevo issue con detalles completos
3. Incluye logs de error y configuración relevante

---

¡Disfruta transmitiendo! 🎉

### Paso 2: Copia los archivos de entorno

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Paso 3: Instala dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

### Paso 4: Inicia backend y frontend en dos terminales

Terminal 1:
```bash
cd backend && npm run dev
```

Terminal 2:
```bash
cd frontend && npm run dev
```

### Paso 5: Abre en el navegador

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api`

## Endpoints principales

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/profile`
- `PUT /api/users/profile`
- `GET /api/streams/active`
- `POST /api/streams/start`
- `POST /api/reports`
- `GET /api/admin/users`
- `GET /api/admin/streams`

## Escalabilidad

- Backend modularizado en rutas, controladores y servicios.
- Mongoose con modelos separados para usuarios, streams y mensajes.
- Socket.IO aislado en `backend/sockets`.
- Next.js App Router con componentes y hooks reutilizables.
- LiveKit maneja escalabilidad de video automáticamente.
- Configuración de PM2 y Nginx preparada para VPS.

## Archivos importantes

- `QUICK_START.md` — Cómo levantar en 5 minutos
- `LIVEKIT_SETUP.md` — Guía detallada de LiveKit
- `ecosystem.config.js` — Configuración PM2 para producción
- `nginx.conf` — Proxy inverso para VPS

const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const streamRoutes = require('./routes/streams');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const { initChatSocket } = require('./sockets/chat');
const { UPLOADS_DIR } = require('./services/uploads');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

connectDB();

app.use(cors({ origin: ['http://localhost:3000'] }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(UPLOADS_DIR));

const healthCheck = require('./healthcheck');

// ... existing code ...

app.get('/health', healthCheck);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use(errorHandler);

initChatSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

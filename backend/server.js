const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const apiRouter = require('./routes/api');
const healthRouter = require('./routes/health');
const { registerSocketHandlers } = require('./socket-handlers');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api', apiRouter(io));

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

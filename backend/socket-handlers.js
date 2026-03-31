const sessionManager = require('./services/sessionManager');

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('lobby:join', () => {
      socket.join('lobby');
      socket.emit('lobby:sessions', sessionManager.getPublicSessions());
    });

    socket.on('session:join', ({ sessionId, username }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }
      socket.join(sessionId);
      sessionManager.addViewer(sessionId, { id: socket.id, username });
      const count = sessionManager.getViewerCount(sessionId);
      io.to(sessionId).emit('session:userJoined', { username, count });
      socket.emit('session:joined', { session, username });
      io.to('lobby').emit('lobby:sessions', sessionManager.getPublicSessions());
      console.log(`${username} joined session ${sessionId}`);
    });

    socket.on('playback:play', ({ sessionId }) => {
      const viewer = sessionManager.getViewer(sessionId, socket.id);
      const username = viewer ? viewer.username : 'Someone';
      sessionManager.updatePlaybackState(sessionId, { paused: false });
      io.to(sessionId).emit('action:play', { executedBy: username, timestamp: Date.now() });
    });

    socket.on('playback:pause', ({ sessionId }) => {
      const viewer = sessionManager.getViewer(sessionId, socket.id);
      const username = viewer ? viewer.username : 'Someone';
      sessionManager.updatePlaybackState(sessionId, { paused: true });
      io.to(sessionId).emit('action:pause', { executedBy: username, timestamp: Date.now() });
    });

    socket.on('playback:seek', ({ sessionId, seconds }) => {
      const viewer = sessionManager.getViewer(sessionId, socket.id);
      const username = viewer ? viewer.username : 'Someone';
      sessionManager.updatePlaybackState(sessionId, { position: seconds });
      io.to(sessionId).emit('action:seeked', { seconds, executedBy: username, timestamp: Date.now() });
    });

    socket.on('playback:position', ({ sessionId, seconds }) => {
      sessionManager.updatePlaybackState(sessionId, { position: seconds });
      // Broadcast to others in session (not back to sender)
      socket.to(sessionId).emit('action:position', { seconds });
    });

    socket.on('disconnect', () => {
      const sessions = sessionManager.getAllSessions();
      for (const session of sessions) {
        const viewer = sessionManager.getViewer(session.id, socket.id);
        if (viewer) {
          sessionManager.removeViewer(session.id, socket.id);
          const count = sessionManager.getViewerCount(session.id);
          io.to(session.id).emit('session:userLeft', { username: viewer.username, count });
          io.to('lobby').emit('lobby:sessions', sessionManager.getPublicSessions());
          break;
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = { registerSocketHandlers };

const net = require('net');

// Map of socketId → net.Socket (MPV IPC connection)
const connections = new Map();

function connect(socketId, mpvSocketPath) {
  if (connections.has(socketId)) disconnect(socketId);

  const client = net.createConnection(mpvSocketPath);
  client.on('connect', () => {
    console.log(`MPV connected for ${socketId} at ${mpvSocketPath}`);
  });
  client.on('error', (err) => {
    console.warn(`MPV IPC error for ${socketId}:`, err.message);
    connections.delete(socketId);
  });
  client.on('close', () => {
    connections.delete(socketId);
  });
  connections.set(socketId, client);
}

function disconnect(socketId) {
  const client = connections.get(socketId);
  if (client) {
    client.destroy();
    connections.delete(socketId);
  }
}

function sendCommand(socketId, command) {
  const client = connections.get(socketId);
  if (!client || client.destroyed) return;
  try {
    client.write(JSON.stringify(command) + '\n');
  } catch (err) {
    console.warn(`Failed to send MPV command to ${socketId}:`, err.message);
  }
}

function broadcastToSession(sessionId, sessionManager, command) {
  const session = sessionManager.getSession(sessionId);
  if (!session) return;
  for (const viewer of session.viewers) {
    sendCommand(viewer.id, command);
  }
}

function seekCommand(seconds) {
  return { command: ['seek', seconds, 'absolute'] };
}

module.exports = { connect, disconnect, sendCommand, broadcastToSession, seekCommand };

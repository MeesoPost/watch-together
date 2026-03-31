#!/usr/bin/env node
// Watch Together Bridge
// Connects this machine's MPV to the watch party server.
//
// Usage:
//   node index.js <sessionId> [username] [serverUrl]
//
// Example:
//   node index.js sess_abc123
//   node index.js sess_abc123 mees http://localhost:3001

const { io } = require('socket.io-client');
const net = require('net');
const os = require('os');

const sessionId = process.argv[2];
const username = process.argv[3] || os.userInfo().username;
const serverUrl = process.argv[4] || 'http://localhost:3001';
const mpvSocketPath = process.platform === 'win32' ? '\\\\.\\pipe\\mpv' : '/tmp/mpvsocket';

if (!sessionId) {
  console.error('Usage: node index.js <sessionId> [username] [serverUrl]');
  console.error('Example: node index.js sess_abc123');
  process.exit(1);
}

console.log(`Bridge starting...`);
console.log(`  Session:  ${sessionId}`);
console.log(`  Username: ${username}`);
console.log(`  Server:   ${serverUrl}`);
console.log(`  MPV:      ${mpvSocketPath}`);
console.log('');

// --- MPV IPC ---

let mpvClient = null;
let mpvConnected = false;

function connectMpv() {
  mpvClient = net.createConnection(mpvSocketPath);

  mpvClient.on('connect', () => {
    mpvConnected = true;
    console.log('[MPV] Connected');
  });

  mpvClient.on('error', (err) => {
    mpvConnected = false;
    if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
      console.log('[MPV] Not running yet, retrying in 2s...');
    } else {
      console.error('[MPV] Error:', err.message);
    }
    setTimeout(connectMpv, 2000);
  });

  mpvClient.on('close', () => {
    mpvConnected = false;
    console.log('[MPV] Disconnected, retrying...');
    setTimeout(connectMpv, 2000);
  });
}

function sendMpv(command) {
  if (!mpvClient || !mpvConnected) {
    console.warn('[MPV] Not connected, command dropped:', JSON.stringify(command));
    return;
  }
  mpvClient.write(JSON.stringify(command) + '\n');
}

connectMpv();

// --- WebSocket ---

const socket = io(serverUrl, { reconnectionDelay: 1000 });

socket.on('connect', () => {
  console.log('[Server] Connected');
  socket.emit('session:join', { sessionId, username: `${username} (bridge)` });
});

socket.on('session:joined', ({ session }) => {
  console.log(`[Server] Joined session: ${session.title}`);
  console.log(`[MPV] Loading file: ${session.mediaPath}`);
  sendMpv({ command: ['loadfile', session.mediaPath, 'replace'] });
  // Start paused so everyone can sync before playing
  setTimeout(() => sendMpv({ command: ['set_property', 'pause', true] }), 500);
});

socket.on('action:play', ({ executedBy }) => {
  console.log(`[Sync] Play — triggered by ${executedBy}`);
  sendMpv({ command: ['set_property', 'pause', false] });
});

socket.on('action:pause', ({ executedBy }) => {
  console.log(`[Sync] Pause — triggered by ${executedBy}`);
  sendMpv({ command: ['set_property', 'pause', true] });
});

socket.on('action:seeked', ({ seconds, executedBy }) => {
  console.log(`[Sync] Seek to ${seconds}s — triggered by ${executedBy}`);
  sendMpv({ command: ['seek', seconds, 'absolute'] });
});

socket.on('session:userJoined', ({ username: u, count }) => {
  console.log(`[Session] ${u} joined (${count} watching)`);
});

socket.on('session:userLeft', ({ username: u, count }) => {
  console.log(`[Session] ${u} left (${count} watching)`);
});

socket.on('error', ({ message }) => {
  console.error('[Server] Error:', message);
});

socket.on('disconnect', () => {
  console.log('[Server] Disconnected, reconnecting...');
});

console.log('Bridge running. Press Ctrl+C to stop.\n');

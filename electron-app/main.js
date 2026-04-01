const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { io } = require('socket.io-client');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// ── Config ────────────────────────────────────────────────────────────────────

const MPV_SOCKET = os.platform() === 'win32' ? '\\\\.\\pipe\\mpv' : '/tmp/mpvsocket';
const IS_WIN = os.platform() === 'win32';
const IS_MAC_ARM = os.platform() === 'darwin' && os.arch() === 'arm64';

// ── Find MPV binary ───────────────────────────────────────────────────────────
// In dev: use system MPV. In production: use bundled binary from resources/.

function getMpvPath() {
  if (app.isPackaged) {
    const bin = IS_WIN ? 'mpv.exe' : 'mpv';
    return path.join(process.resourcesPath, bin);
  }
  // Dev: use system MPV
  return IS_WIN ? 'mpv' : '/opt/homebrew/bin/mpv';
}

// ── State ─────────────────────────────────────────────────────────────────────

let win = null;
let mpvProcess = null;
let mpvClient = null;
let mpvConnected = false;
let socket = null;
let pendingUrl = null;
let activeSessionId = null;   // prevent duplicate bridge starts
let pendingLoadFile = null;   // file to load once MPV IPC is ready
let pendingSeek = null;       // position to seek to after reopen
let currentMediaUrl = null;   // last loaded file/URL, for reopen
let suppressUntil = 0;        // suppress MPV events we caused ourselves
let mpvBuffer = '';           // buffer for partial IPC messages
let positionPollTimer = null;
let lastKnownPosition = 0;
let lastPositionTime = Date.now();
let isQuitting = false;

// ── MPV ───────────────────────────────────────────────────────────────────────

function startMpv() {
  if (mpvProcess) return;

  const mpvPath = getMpvPath();
  console.log('[MPV] Starting:', mpvPath);

  mpvProcess = spawn(mpvPath, [
    `--input-ipc-server=${MPV_SOCKET}`,
    '--idle=yes',
    '--force-window=yes',
    '--keep-open=yes',
  ], { detached: false });

  mpvProcess.on('error', (err) => console.error('[MPV] Failed to start:', err.message));
  mpvProcess.on('exit', () => {
    console.log('[MPV] Exited');
    mpvProcess = null;
    mpvConnected = false;
    if (!isQuitting && activeSessionId && win) {
      win.webContents.send('mpv:closed');
    }
  });

  // Give MPV a moment to create the socket, then connect
  setTimeout(connectMpvIpc, 1000);
}

function connectMpvIpc() {
  if (mpvClient) mpvClient.destroy();

  mpvClient = net.createConnection(MPV_SOCKET);

  mpvClient.on('connect', () => {
    mpvConnected = true;
    mpvBuffer = '';
    console.log('[MPV] IPC connected');

    // Observe pause property — MPV will push events when it changes
    mpvClient.write(JSON.stringify({ command: ['observe_property', 1, 'pause'] }) + '\n');

    // Start polling playback position every second
    startPositionPolling();

    // Send any file that was waiting for IPC to be ready
    if (pendingLoadFile) {
      sendMpv({ command: ['loadfile', pendingLoadFile, 'replace'] });
      const seekTo = pendingSeek;
      setTimeout(() => {
        if (seekTo != null) {
          sendMpv({ command: ['seek', seekTo, 'absolute'] });
          pendingSeek = null;
        }
        sendMpv({ command: ['set_property', 'pause', true] });
      }, 500);
      pendingLoadFile = null;
    }
  });

  mpvClient.on('data', (data) => {
    mpvBuffer += data.toString();
    const lines = mpvBuffer.split('\n');
    mpvBuffer = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      if (!line.trim()) continue;
      try { handleMpvEvent(JSON.parse(line)); } catch (_) {}
    }
  });

  mpvClient.on('error', () => {
    mpvConnected = false;
    if (positionPollTimer) { clearInterval(positionPollTimer); positionPollTimer = null; }
    setTimeout(connectMpvIpc, 1500);
  });

  mpvClient.on('close', () => {
    mpvConnected = false;
    if (positionPollTimer) { clearInterval(positionPollTimer); positionPollTimer = null; }
  });
}

function sendMpv(command) {
  if (!mpvClient || !mpvConnected) return;
  try {
    suppressUntil = Date.now() + 600; // ignore MPV events caused by our own commands
    mpvClient.write(JSON.stringify(command) + '\n');
  } catch (e) {
    console.warn('[MPV] Send failed:', e.message);
  }
}

function handleMpvEvent(msg) {
  if (!socket || !activeSessionId) return;
  if (Date.now() < suppressUntil) return; // we caused this event, ignore it

  if (msg.event === 'property-change' && msg.name === 'pause') {
    if (msg.data === true) {
      console.log('[MPV→Server] Pause');
      socket.emit('playback:pause', { sessionId: activeSessionId });
    } else if (msg.data === false) {
      console.log('[MPV→Server] Play');
      socket.emit('playback:play', { sessionId: activeSessionId });
    }
  }

  // Position poll response (request_id 99)
  if (msg.request_id === 99 && msg.data != null) {
    const pos = msg.data;
    const elapsed = (Date.now() - lastPositionTime) / 1000;
    const expected = lastKnownPosition + elapsed;

    // If position jumped more than 3s from expected → user seeked in MPV
    if (Math.abs(pos - expected) > 3) {
      console.log(`[MPV→Server] Seek to ${Math.floor(pos)}s`);
      socket.emit('playback:seek', { sessionId: activeSessionId, seconds: pos });
    }

    // Always broadcast position for timer sync
    socket.emit('playback:position', { sessionId: activeSessionId, seconds: pos });
    lastKnownPosition = pos;
    lastPositionTime = Date.now();
  }
}

function startPositionPolling() {
  if (positionPollTimer) clearInterval(positionPollTimer);
  positionPollTimer = setInterval(() => {
    if (mpvConnected && activeSessionId) {
      mpvClient.write(JSON.stringify({ command: ['get_property', 'playback-time'], request_id: 99 }) + '\n');
    }
  }, 1000);
}

// ── Bridge (WebSocket → MPV) ──────────────────────────────────────────────────

function startBridge(sessionId, serverUrl) {
  if (activeSessionId === sessionId) return; // already connected to this session
  activeSessionId = sessionId;
  if (socket) socket.disconnect();

  console.log(`[Bridge] Connecting to ${serverUrl}, session ${sessionId}`);

  socket = io(serverUrl, { reconnectionDelay: 1000 });

  socket.on('connect', () => {
    console.log('[Bridge] Connected to server');
    socket.emit('session:join', { sessionId, username: os.userInfo().username });
  });

  socket.on('session:joined', ({ session }) => {
    console.log('[Bridge] Joined:', session.title);
    const mediaUrl = session.streamPath
      ? `${serverUrl}${session.streamPath}`
      : session.mediaPath;
    currentMediaUrl = mediaUrl;
    if (mpvConnected) {
      sendMpv({ command: ['loadfile', mediaUrl, 'replace'] });
      setTimeout(() => sendMpv({ command: ['set_property', 'pause', true] }), 300);
    } else {
      // IPC not ready yet — queue it, will fire on 'connect'
      pendingLoadFile = mediaUrl;
    }
  });

  socket.on('action:play', ({ executedBy }) => {
    console.log('[Bridge] Play by', executedBy);
    sendMpv({ command: ['set_property', 'pause', false] });
  });

  socket.on('action:pause', ({ executedBy }) => {
    console.log('[Bridge] Pause by', executedBy);
    sendMpv({ command: ['set_property', 'pause', true] });
  });

  socket.on('action:seeked', ({ seconds, executedBy }) => {
    console.log(`[Bridge] Seek to ${seconds}s by ${executedBy}`);
    sendMpv({ command: ['seek', seconds, 'absolute'] });
  });

  socket.on('error', ({ message }) => console.error('[Bridge] Error:', message));
}

// ── Handle watchtogether:// URL ───────────────────────────────────────────────
// Format: watchtogether://sess_abc123@server:3001
// Example: watchtogether://sess_abc123@100.90.84.95:3001

function handleUrl(url) {
  console.log('[URL] Handling:', url);
  try {
    // Strip protocol
    const raw = url.replace('watchtogether://', '');
    const [sessionId, hostPort] = raw.split('@');
    const serverUrl = hostPort ? `http://${hostPort}` : 'http://localhost:3001';
    const webUrl = serverUrl.replace(':3001', ':3000') + `/join/${sessionId}`;

    // Open browser window with the watch UI
    if (win) {
      win.loadURL(webUrl);
      win.show();
    }

    // Start MPV + bridge
    startMpv();
    startBridge(sessionId, serverUrl);
  } catch (e) {
    console.error('[URL] Failed to parse:', e.message);
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

ipcMain.handle('mpv:reopen', (event, { position }) => {
  console.log(`[IPC] Reopen MPV at ${Math.floor(position)}s`);
  pendingLoadFile = currentMediaUrl;
  pendingSeek = position;
  startMpv();
});

function createWindow(url = 'http://localhost:3000') {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Watch Together',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL(url);
  win.on('closed', () => { win = null; });

  // Auto-start MPV + bridge when navigating to a /join/ URL inside the app
  win.webContents.on('did-navigate', (event, navUrl) => {
    const match = navUrl.match(/\/join\/(sess_\w+)/);
    if (match) {
      const sessionId = match[1];
      const serverUrl = new URL(navUrl).origin.replace(':3000', ':3001');
      console.log('[App] Detected join URL, starting MPV + bridge for', sessionId);
      startMpv();
      startBridge(sessionId, serverUrl);
    }
  });

  // Also handle in-app navigation (React Router uses pushState, not full navigates)
  win.webContents.on('did-navigate-in-page', (event, navUrl) => {
    const match = navUrl.match(/\/join\/(sess_\w+)/);
    if (match) {
      const sessionId = match[1];
      const serverUrl = new URL(navUrl).origin.replace(':3000', ':3001');
      console.log('[App] Detected in-page join, starting MPV + bridge for', sessionId);
      startMpv();
      startBridge(sessionId, serverUrl);
    }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Register custom URL scheme
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('watchtogether', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('watchtogether');
}

app.whenReady().then(() => {
  createWindow();

  // Handle URL passed at launch (macOS opens app with URL as arg)
  const urlArg = process.argv.find((a) => a.startsWith('watchtogether://'));
  if (urlArg) handleUrl(urlArg);
  if (pendingUrl) handleUrl(pendingUrl);
});

// macOS: URL opened while app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (app.isReady()) handleUrl(url);
  else pendingUrl = url;
});

// Windows: URL opens a second instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    const url = argv.find((a) => a.startsWith('watchtogether://'));
    if (url) handleUrl(url);
    if (win) { win.show(); win.focus(); }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  isQuitting = true;
  if (socket) socket.disconnect();
  if (mpvClient) mpvClient.destroy();
  if (mpvProcess) mpvProcess.kill();
});

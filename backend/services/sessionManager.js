const { v4: uuidv4 } = require('uuid');

const sessions = new Map();

function createSession({ mediaPath, streamPath, title }) {
  const id = `sess_${uuidv4().slice(0, 8)}`;
  const session = {
    id,
    mediaPath,
    streamPath: streamPath || null,
    title: title || mediaPath.split('/').pop(),
    createdAt: Date.now(),
    viewers: [],
    playbackState: { paused: true, position: 0 },
  };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id) || null;
}

function getAllSessions() {
  return Array.from(sessions.values());
}

function deleteSession(id) {
  return sessions.delete(id);
}

function addViewer(sessionId, viewer) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.viewers.push(viewer);
}

function removeViewer(sessionId, socketId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.viewers = session.viewers.filter((v) => v.id !== socketId);
}

function getViewer(sessionId, socketId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return session.viewers.find((v) => v.id === socketId) || null;
}

function getViewerCount(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.viewers.length : 0;
}

function updatePlaybackState(sessionId, update) {
  const session = sessions.get(sessionId);
  if (!session) return;
  Object.assign(session.playbackState, update);
}

function getPublicSessions() {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    title: s.title,
    viewerCount: s.viewers.length,
    viewers: s.viewers.map((v) => v.username),
    createdAt: s.createdAt,
  }));
}

module.exports = {
  createSession,
  getSession,
  getAllSessions,
  deleteSession,
  addViewer,
  removeViewer,
  getViewer,
  getViewerCount,
  updatePlaybackState,
  getPublicSessions,
};

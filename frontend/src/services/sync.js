import { getSocket } from './socket.js';

export function emitPlay(sessionId) {
  getSocket().emit('playback:play', { sessionId });
}

export function emitPause(sessionId) {
  getSocket().emit('playback:pause', { sessionId });
}

export function emitSeek(sessionId, seconds) {
  getSocket().emit('playback:seek', { sessionId, seconds });
}

export function emitChat(sessionId, text) {
  getSocket().emit('chat:message', { sessionId, text });
}

export function joinSession(sessionId, username) {
  getSocket().emit('session:join', { sessionId, username });
}

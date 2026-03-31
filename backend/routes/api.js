const express = require('express');
const sessionManager = require('../services/sessionManager');

function broadcastSessions(io) {
  io.to('lobby').emit('lobby:sessions', sessionManager.getPublicSessions());
}

module.exports = function apiRouter(io) {
const router = express.Router();

// Mock media library for demo
const MOCK_MEDIA = [
  { path: '/Users/mees/Downloads/Flightplan (2005) (1080p BluRay x265 HEVC 10bit AAC 5.1 Tigole)/Flightplan (2005) (1080p BluRay x265 10bit Tigole).mkv', title: 'Flightplan (2005)', duration: 5820 },
  { path: '/data/movies/Inception.mkv', title: 'Inception', duration: 8880 },
  { path: '/data/movies/Interstellar.mkv', title: 'Interstellar', duration: 10140 },
  { path: '/data/movies/TheMatrix.mkv', title: 'The Matrix', duration: 8160 },
];

router.get('/media', (req, res) => {
  res.json(MOCK_MEDIA);
});

router.post('/sessions', (req, res) => {
  const { mediaPath } = req.body;
  if (!mediaPath) {
    return res.status(400).json({ error: 'mediaPath is required' });
  }
  const media = MOCK_MEDIA.find((m) => m.path === mediaPath);
  const session = sessionManager.createSession({
    mediaPath,
    title: media ? media.title : mediaPath.split('/').pop(),
  });
  broadcastSessions(io);
  res.status(201).json({
    sessionId: session.id,
    joinUrl: `/join/${session.id}`,
    session,
  });
});

router.get('/sessions/:sessionId', (req, res) => {
  const session = sessionManager.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

router.delete('/sessions/:sessionId', (req, res) => {
  const deleted = sessionManager.deleteSession(req.params.sessionId);
  if (!deleted) return res.status(404).json({ error: 'Session not found' });
  res.json({ deleted: true });
});

return router;
};

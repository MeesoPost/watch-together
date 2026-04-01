const express = require('express');
const fs = require('fs');
const path = require('path');
const sessionManager = require('../services/sessionManager');

const PLEX_URL = (process.env.PLEX_URL || 'http://localhost:32400').replace(/\/$/, '');
const PLEX_TOKEN = process.env.PLEX_TOKEN || '';

function broadcastSessions(io) {
  io.to('lobby').emit('lobby:sessions', sessionManager.getPublicSessions());
}

// ratingKey -> absolute file path on disk, populated lazily
const filePathByKey = new Map();

async function plexGet(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`${PLEX_URL}${endpoint}${sep}X-Plex-Token=${PLEX_TOKEN}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Plex HTTP ${res.status} on ${endpoint}`);
  return res.json();
}

async function resolveFilePath(ratingKey) {
  if (filePathByKey.has(ratingKey)) return filePathByKey.get(ratingKey);
  const data = await plexGet(`/library/metadata/${ratingKey}`);
  const filePath = data.MediaContainer?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.file ?? null;
  if (filePath) filePathByKey.set(ratingKey, filePath);
  return filePath;
}

module.exports = function apiRouter(io) {
  const router = express.Router();

  // ── GET /api/media ────────────────────────────────────────────────────────
  // Returns all movies and shows from Plex, flat array with type field.
  router.get('/media', async (req, res) => {
    try {
      const sections = await plexGet('/library/sections');
      const dirs = sections.MediaContainer?.Directory ?? [];
      const library = [];

      for (const section of dirs) {
        if (section.type === 'movie') {
          const data = await plexGet(`/library/sections/${section.key}/all`);
          for (const item of data.MediaContainer?.Metadata ?? []) {
            const filePath = item.Media?.[0]?.Part?.[0]?.file;
            if (filePath) filePathByKey.set(item.ratingKey, filePath);
            library.push({
              id: item.ratingKey,
              type: 'movie',
              title: item.title,
              year: item.year ?? null,
              streamPath: `/api/media/stream/${item.ratingKey}`,
            });
          }
        } else if (section.type === 'show') {
          const data = await plexGet(`/library/sections/${section.key}/all`);
          for (const item of data.MediaContainer?.Metadata ?? []) {
            library.push({
              id: item.ratingKey,
              type: 'series',
              title: item.title,
              year: item.year ?? null,
              seasonCount: item.childCount ?? null,
            });
          }
        }
      }

      library.sort((a, b) => a.title.localeCompare(b.title));
      res.json(library);
    } catch (err) {
      console.error('[Plex] Failed to load library:', err.message);
      res.status(502).json({ error: 'Could not reach Plex', detail: err.message });
    }
  });

  // ── GET /api/media/:key/children ──────────────────────────────────────────
  // Returns seasons for a show, or episodes for a season.
  router.get('/media/:key/children', async (req, res) => {
    try {
      const data = await plexGet(`/library/metadata/${req.params.key}/children`);
      const items = data.MediaContainer?.Metadata ?? [];
      const children = items.map((item) => {
        const filePath = item.Media?.[0]?.Part?.[0]?.file ?? null;
        if (filePath) filePathByKey.set(item.ratingKey, filePath);
        return {
          id: item.ratingKey,
          type: item.type,           // 'season' or 'episode'
          title: item.title,
          index: item.index ?? null, // season number or episode number
          streamPath: filePath ? `/api/media/stream/${item.ratingKey}` : null,
        };
      });
      res.json(children);
    } catch (err) {
      console.error('[Plex] Failed to load children:', err.message);
      res.status(502).json({ error: 'Could not reach Plex', detail: err.message });
    }
  });

  // ── GET /api/media/stream/:key ────────────────────────────────────────────
  // Streams a file by Plex ratingKey with range request support.
  router.get('/media/stream/:key', async (req, res) => {
    try {
      const filePath = await resolveFilePath(req.params.key);
      if (!filePath) return res.status(404).json({ error: 'Media not found in Plex' });

      let stat;
      try { stat = fs.statSync(filePath); }
      catch { return res.status(404).json({ error: 'File not found on disk' }); }

      const fileSize = stat.size;
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.mp4' ? 'video/mp4'
        : ext === '.webm' ? 'video/webm'
        : 'video/x-matroska';

      const range = req.headers.range;
      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': contentType,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error('[Stream] Error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
    }
  });

  // ── POST /api/sessions ────────────────────────────────────────────────────
  router.post('/sessions', async (req, res) => {
    const { mediaId, title } = req.body;
    if (!mediaId) return res.status(400).json({ error: 'mediaId is required' });

    const filePath = await resolveFilePath(mediaId).catch(() => null);
    const streamPath = `/api/media/stream/${mediaId}`;

    const session = sessionManager.createSession({
      mediaPath: filePath ?? mediaId,
      streamPath,
      title: title ?? mediaId,
    });
    broadcastSessions(io);
    res.status(201).json({ sessionId: session.id, joinUrl: `/join/${session.id}`, session });
  });

  // ── GET /api/sessions/:sessionId ──────────────────────────────────────────
  router.get('/sessions/:sessionId', (req, res) => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  // ── DELETE /api/sessions/:sessionId ──────────────────────────────────────
  router.delete('/sessions/:sessionId', (req, res) => {
    const deleted = sessionManager.deleteSession(req.params.sessionId);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    res.json({ deleted: true });
  });

  return router;
};

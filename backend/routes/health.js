const express = require('express');
const router = express.Router();
const sessionManager = require('../services/sessionManager');

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    sessions: sessionManager.getAllSessions().length,
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const realtimeService = require('../services/realtimeService');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/realtime/stream
 * Server-Sent Events (SSE) stream for real-time inventory updates and user notifications
 */
router.get('/stream', optionalAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const userId = req.user?.id || null;
  realtimeService.addClient(res, userId);
});

module.exports = router;

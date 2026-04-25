const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  getPrivateSessionConfig,
  getStreamPrivateSessions,
  requestSession,
  getPrivateSession,
  confirmSession,
  rejectSession,
  cancelSession,
  endSession,
  joinSession,
} = require('../controllers/privateSessionController');

router.get('/config', getPrivateSessionConfig);
router.get('/streams/:streamId', auth, getStreamPrivateSessions);
router.post('/streams/:streamId/request', auth, requestSession);
router.post('/:id/join', auth, joinSession);
router.post('/:id/confirm', auth, confirmSession);
router.post('/:id/reject', auth, rejectSession);
router.post('/:id/cancel', auth, cancelSession);
router.post('/:id/end', auth, endSession);
router.get('/:id', auth, getPrivateSession);

module.exports = router;

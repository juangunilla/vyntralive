const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { authorize } = require('../middlewares/roles');
const {
  getActiveStreams,
  startStream,
  getStreamById,
  getStreamPreview,
  joinStream,
  upsertObsIngress,
  tipStreamCreator,
} = require('../controllers/streamController');

router.get('/active', getActiveStreams);
router.post('/start', auth, authorize(['creator', 'admin']), startStream);
router.get('/:id/preview', getStreamPreview);
router.post('/:id/obs', auth, authorize(['creator', 'admin']), upsertObsIngress);
router.post('/:id/tip', auth, tipStreamCreator);
router.get('/:id', getStreamById);
router.post('/join', auth, joinStream);

module.exports = router;

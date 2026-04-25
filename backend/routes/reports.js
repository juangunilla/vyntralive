const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { createReport, getReports } = require('../controllers/reportController');

router.post('/', auth, createReport);
router.get('/', auth, getReports);

module.exports = router;

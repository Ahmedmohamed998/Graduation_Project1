const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getDashboard } = require('../controllers/dashboardController');

// All dashboard routes require authentication
router.use(verifyToken);

// GET /api/dashboard - Get home screen data
router.get('/', getDashboard);

module.exports = router;

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const verifyToken = require('../middleware/verifyToken');

// Get all settings
router.get('/', verifyToken, settingsController.getSettings);

// Update theme
router.put('/theme', verifyToken, settingsController.updateTheme);

// Update currency
router.put('/currency', verifyToken, settingsController.updateCurrency);

// Update date format
router.put('/date-format', verifyToken, settingsController.updateDateFormat);

// Toggle biometric
router.put('/biometric', verifyToken, settingsController.toggleBiometric);

// Update notification preferences
router.put('/notifications', verifyToken, settingsController.updateNotifications);

// Data management
router.post('/backup', verifyToken, settingsController.backupData);
router.post('/restore', verifyToken, settingsController.restoreData);
router.post('/clear-all', verifyToken, settingsController.clearAllData);

// App information
router.get('/app-info', verifyToken, settingsController.getAppInfo);

module.exports = router;

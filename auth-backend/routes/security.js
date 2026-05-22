const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { verifyToken } = require('../middleware/auth');

// Password Management
router.post('/change-password', verifyToken, securityController.changePassword);

// 2FA Management
router.post('/2fa/setup', verifyToken, securityController.setup2FA);
router.post('/2fa/verify', verifyToken, securityController.verify2FA);
router.post('/2fa/disable', verifyToken, securityController.disable2FA);
router.get('/2fa/status', verifyToken, securityController.get2FAStatus);

// Device Management
router.get('/devices', verifyToken, securityController.listDevices);
router.delete('/devices/:deviceId', verifyToken, securityController.removeDevice);
router.put('/devices/:deviceId/trust', verifyToken, securityController.trustDevice);

module.exports = router;

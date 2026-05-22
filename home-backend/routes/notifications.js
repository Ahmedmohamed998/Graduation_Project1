const express = require('express');
const router  = express.Router();
const verifyToken = require('../middleware/verifyToken');

const {
  registerToken,
  unregisterToken,
  getMyDevices,
  sendNotification,
  testNotification,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(verifyToken);

/**
 * @route  POST /api/notifications/register-token
 * @desc   Register (or refresh) an FCM device token
 * @body   { fcmToken, deviceType?, deviceName? }
 */
router.post('/register-token', registerToken);

/**
 * @route  DELETE /api/notifications/unregister-token
 * @desc   Deactivate a device token (call on logout)
 * @body   { fcmToken }
 */
router.delete('/unregister-token', unregisterToken);

/**
 * @route  GET /api/notifications/devices
 * @desc   List all devices registered by the current user
 */
router.get('/devices', getMyDevices);

/**
 * @route  POST /api/notifications/send
 * @desc   Send a custom push notification
 * @body   { title, body, data?, userId? }
 */
router.post('/send', sendNotification);

/**
 * @route  POST /api/notifications/test
 * @desc   Send a test push to the authenticated user's devices
 */
router.post('/test', testNotification);

module.exports = router;

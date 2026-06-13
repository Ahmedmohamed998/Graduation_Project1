const UserDevice = require('../models/UserDevice');
const { sendCustomNotification } = require('../utils/notifications');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────
//  POST /api/notifications/register-token
//  Mobile app calls this after obtaining an FCM token.
// ─────────────────────────────────────────────────────────
const registerToken = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { fcmToken, deviceType = 'unknown', deviceName = '' } = req.body;

    if (!fcmToken || !fcmToken.trim()) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }

    // Upsert: if same token already exists for this user, just update metadata
    const device = await UserDevice.findOneAndUpdate(
      { userId, fcmToken },
      {
        $set: {
          deviceType,
          deviceName,
          active: true,
          lastSeen: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(`[FCM] Token registered for user ${userId} (${deviceType})`);

    res.status(200).json({
      message: 'Device token registered successfully',
      deviceId: device._id,
    });
  } catch (error) {
    logger.error('Error registering FCM token:', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
//  DELETE /api/notifications/unregister-token
//  Call this on logout so the device no longer receives pushes.
// ─────────────────────────────────────────────────────────
const unregisterToken = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }

    await UserDevice.findOneAndUpdate(
      { userId, fcmToken },
      { $set: { active: false } }
    );

    logger.info(`[FCM] Token unregistered for user ${userId}`);
    res.status(200).json({ message: 'Device token unregistered successfully' });
  } catch (error) {
    logger.error('Error unregistering FCM token:', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
//  GET /api/notifications/devices
//  List all devices registered by the current user.
// ─────────────────────────────────────────────────────────
const getMyDevices = async (req, res, next) => {
  try {
    const userId = req.userId;
    const devices = await UserDevice.find({ userId }).sort({ lastSeen: -1 });

    res.status(200).json({ devices });
  } catch (error) {
    logger.error('Error fetching devices:', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
//  POST /api/notifications/send
//  Manual / custom notification (admin or testing use).
//  Body: { userId?, title, body, data? }
//  If userId is omitted, sends to the authenticated user.
// ─────────────────────────────────────────────────────────
const sendNotification = async (req, res, next) => {
  try {
    const { userId: targetUserId, title, body, data } = req.body;
    const userId = targetUserId || req.userId;

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    const result = await sendCustomNotification(userId, title, body, data || {});

    res.status(200).json({
      message: 'Notification sent',
      ...result,
    });
  } catch (error) {
    logger.error('Error sending notification:', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
//  POST /api/notifications/test
//  Quick self-test: sends a test push to the caller's devices.
// ─────────────────────────────────────────────────────────
const testNotification = async (req, res, next) => {
  try {
    const userId = req.userId;

    const result = await sendCustomNotification(
      userId,
      '🔔 Test Notification',
      'Firebase Cloud Messaging is working correctly on Hasibha!',
      { type: 'test', timestamp: new Date().toISOString() }
    );

    res.status(200).json({
      message: 'Test notification sent',
      ...result,
    });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
//  POST /api/notifications/trigger-daily-reminder
//  Manually trigger the daily reminder check (for testing/cron simulation).
// ─────────────────────────────────────────────────────────
const triggerDailyReminder = async (req, res, next) => {
  try {
    const { processDailyReminders } = require('../utils/scheduler');
    
    // Trigger in the background or await depending on requirement
    await processDailyReminders();

    res.status(200).json({
      message: 'Daily expense reminder scan triggered successfully',
    });
  } catch (error) {
    logger.error('Error manual triggering daily reminder scan:', error);
    next(error);
  }
};

module.exports = {
  registerToken,
  unregisterToken,
  getMyDevices,
  sendNotification,
  testNotification,
  triggerDailyReminder,
};

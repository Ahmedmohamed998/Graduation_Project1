const { initFirebase } = require('./firebase');
const logger = require('./logger');

// Lazy-load UserDevice to avoid circular-require at startup
const getUserDeviceModel = () => require('../models/UserDevice');

/**
 * Send a FCM notification to a single device token.
 *
 * @param {string} token   - FCM device token
 * @param {string} title   - Notification title
 * @param {string} body    - Notification body
 * @param {object} data    - Optional key-value payload (all values must be strings)
 * @returns {Promise<string|null>} messageId or null on failure
 */
async function sendToToken(token, title, body, data = {}) {
  try {
    const admin = initFirebase();
    const message = {
      token,
      notification: { title, body },
      data: stringifyData(data),
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };
    const messageId = await admin.messaging().send(message);
    logger.info(`[FCM] Sent to token ${token.slice(0, 20)}… → ${messageId}`);
    return messageId;
  } catch (err) {
    logger.warn(`[FCM] Failed to send to token ${token.slice(0, 20)}…: ${err.message}`);
    return null;
  }
}

/**
 * Send a notification to ALL registered devices of a user.
 * Automatically removes invalid/expired tokens from the database.
 *
 * @param {string|ObjectId} userId
 * @param {string} title
 * @param {string} body
 * @param {object} data    - Optional extra data payload
 * @returns {Promise<{sent:number, failed:number}>}
 */
async function sendToUser(userId, title, body, data = {}) {
  const UserDevice = getUserDeviceModel();
  const devices = await UserDevice.find({ userId, active: true });

  if (!devices.length) {
    logger.info(`[FCM] No active devices for user ${userId}`);
    return { sent: 0, failed: 0 };
  }

  const tokens = devices.map(d => d.fcmToken);
  const admin  = initFirebase();

  const multicastMessage = {
    tokens,
    notification: { title, body },
    data: stringifyData(data),
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(multicastMessage);
    let sent = 0, failed = 0;

    // Clean up invalid tokens
    const invalidTokens = [];
    response.responses.forEach((res, idx) => {
      if (res.success) {
        sent++;
      } else {
        failed++;
        const errCode = res.error?.code || '';
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx]);
        }
        logger.warn(`[FCM] Token ${tokens[idx].slice(0, 20)}… failed: ${res.error?.message}`);
      }
    });

    if (invalidTokens.length > 0) {
      await UserDevice.updateMany(
        { userId, fcmToken: { $in: invalidTokens } },
        { $set: { active: false } }
      );
      logger.info(`[FCM] Deactivated ${invalidTokens.length} invalid token(s) for user ${userId}`);
    }

    logger.info(`[FCM] User ${userId}: sent=${sent}, failed=${failed}`);
    return { sent, failed };
  } catch (err) {
    logger.error(`[FCM] Multicast error for user ${userId}:`, err.message);
    return { sent: 0, failed: tokens.length };
  }
}

/**
 * Ensure all values in the data payload are strings (FCM requirement).
 */
function stringifyData(data) {
  const result = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = String(v ?? '');
  }
  return result;
}

// ─── Prebuilt notification templates ─────────────────────────────────────────

/**
 * Budget alert: user has crossed their alertThreshold (%)
 */
async function notifyBudgetAlert(userId, budgetName, percent, category) {
  return sendToUser(
    userId,
    '⚠️ Budget Alert',
    `You've used ${percent}% of your "${budgetName}" budget (${category}).`,
    { type: 'budget_alert', category, percent: String(percent) }
  );
}

/**
 * Budget exceeded: user has gone over 100%
 */
async function notifyBudgetExceeded(userId, budgetName, category) {
  return sendToUser(
    userId,
    '🚨 Budget Exceeded!',
    `Your "${budgetName}" budget for ${category} has been exceeded!`,
    { type: 'budget_exceeded', category }
  );
}

/**
 * Savings goal reached: user completed a savings goal
 */
async function notifyGoalCompleted(userId, goalName) {
  return sendToUser(
    userId,
    '🎉 Savings Goal Reached!',
    `Congratulations! You've completed your savings goal: "${goalName}".`,
    { type: 'goal_completed', goalName }
  );
}

/**
 * Savings milestone: user hit a percentage of their goal
 */
async function notifyGoalMilestone(userId, goalName, percent) {
  return sendToUser(
    userId,
    '💰 Savings Milestone!',
    `You're ${percent}% of the way to your "${goalName}" goal. Keep it up!`,
    { type: 'goal_milestone', goalName, percent: String(percent) }
  );
}

/**
 * Large expense alert
 */
async function notifyLargeExpense(userId, amount, currency, category) {
  return sendToUser(
    userId,
    '💸 Large Expense Recorded',
    `A ${currency} ${amount} expense was added in "${category}".`,
    { type: 'large_expense', amount: String(amount), currency, category }
  );
}

/**
 * Generic / manual notification (admin-triggered)
 */
async function sendCustomNotification(userId, title, body, data = {}) {
  return sendToUser(userId, title, body, data);
}

module.exports = {
  sendToToken,
  sendToUser,
  notifyBudgetAlert,
  notifyBudgetExceeded,
  notifyGoalCompleted,
  notifyGoalMilestone,
  notifyLargeExpense,
  sendCustomNotification,
};

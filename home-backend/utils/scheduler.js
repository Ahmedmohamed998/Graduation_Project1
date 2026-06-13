const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('./logger');

// Lazy-loaded models to avoid startup circular dependency or ordering issues
const getUserProfileModel = () => require('../models/UserProfile');
const getTransactionModel = () => require('../models/Transaction');
const getNotificationLogModel = () => require('../models/NotificationLog');
const getUserDeviceModel = () => require('../models/UserDevice');
const { 
  notifyDailyReminder, 
  notifyWeeklySummary, 
  notifyInactiveUser 
} = require('./notifications');

/**
 * Helper to get the start of the day in a specific timezone
 */
function getStartOfLocalDay(tz) {
  try {
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    nowInTz.setHours(0, 0, 0, 0);
    
    // Now map back to actual UTC time corresponding to that local midnight
    // We can do this by computing formatting differences or simply doing conversion
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    // Find absolute difference
    const utcDate = new Date();
    const parts = formatter.formatToParts(utcDate);
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    
    const tzLocalTime = new Date(
      partMap.year,
      partMap.month - 1,
      partMap.day,
      partMap.hour,
      partMap.minute,
      partMap.second
    );
    
    const diffMs = tzLocalTime.getTime() - utcDate.getTime();
    
    const localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0);
    return new Date(localMidnight.getTime() - diffMs);
  } catch (err) {
    logger.warn(`[Scheduler] Timezone conversion failed for ${tz}: ${err.message}. Using UTC.`);
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}

/**
 * Gets the current hour in the user's timezone (0-23)
 */
function getLocalHour(tz) {
  try {
    const timeString = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    return parseInt(timeString, 10);
  } catch (err) {
    return new Date().getUTCHours();
  }
}

/**
 * Returns YYYY-MM-DD in the specified timezone
 */
function getLocalDateString(tz) {
  try {
    const options = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(new Date());
    return `${year}-${month}-${day}`;
  } catch (err) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Checks all users to see who has not logged expenses today in their local timezone.
 * Designed to run hourly. It filters for users whose local time is currently 20:00 (8 PM).
 */
async function processDailyReminders() {
  logger.info('[Scheduler] Running hourly daily expense reminder check...');
  const UserProfile = getUserProfileModel();
  const Transaction = getTransactionModel();
  const NotificationLog = getNotificationLogModel();
  const UserDevice = getUserDeviceModel();

  try {
    // 1. Find all active user IDs (those with registered active FCM devices)
    const activeDevices = await UserDevice.find({ active: true }).distinct('userId');
    if (!activeDevices.length) {
      logger.info('[Scheduler] No active devices found. Skipping reminders.');
      return;
    }

    const targetHour = parseInt(process.env.DAILY_REMINDER_HOUR || '20', 10);

    for (const userId of activeDevices) {
      try {
        // 2. Fetch User Profile
        let profile = await UserProfile.findOne({ userId });
        if (!profile) {
          profile = await UserProfile.create({ userId });
        }

        // Check user preferences
        if (profile.preferences?.notifications?.dailyReminder === false) {
          continue;
        }

        const tz = profile.timezone || 'UTC';
        const localHour = getLocalHour(tz);

        // We only send reminders at the target hour (e.g. 8 PM local time)
        if (localHour !== targetHour) {
          continue;
        }

        const localDateStr = getLocalDateString(tz);

        // 3. Deduplication Check
        const alreadySent = await NotificationLog.findOne({
          userId,
          type: 'daily_reminder',
          date: localDateStr
        });

        if (alreadySent) {
          continue;
        }

        // 4. Check if they have logged an expense today
        const startOfToday = getStartOfLocalDay(tz);
        const hasExpenses = await Transaction.findOne({
          userId,
          type: 'expense',
          date: { $gte: startOfToday }
        });

        if (!hasExpenses) {
          // 5. Send Reminder
          const result = await notifyDailyReminder(userId);
          
          // Log Notification
          await NotificationLog.create({
            userId,
            type: 'daily_reminder',
            date: localDateStr,
            result: result || { sent: 0, failed: 0 }
          });
        }
      } catch (userErr) {
        logger.error(`[Scheduler] Error checking daily reminder for user ${userId}:`, userErr);
      }
    }
  } catch (error) {
    logger.error('[Scheduler] Daily reminder process failed:', error);
  }
}

/**
 * Weekly summary notification: runs every Sunday evening (8 PM local time).
 */
async function processWeeklySummaries() {
  logger.info('[Scheduler] Running weekly spending summary process...');
  const UserProfile = getUserProfileModel();
  const Transaction = getTransactionModel();
  const NotificationLog = getNotificationLogModel();
  const UserDevice = getUserDeviceModel();

  try {
    const activeDevices = await UserDevice.find({ active: true }).distinct('userId');
    const targetHour = parseInt(process.env.WEEKLY_SUMMARY_HOUR || '20', 10);
    const today = new Date();
    
    // Day 0 is Sunday
    if (today.getDay() !== 0) {
      return;
    }

    for (const userId of activeDevices) {
      try {
        let profile = await UserProfile.findOne({ userId });
        if (!profile) continue;

        if (profile.preferences?.notifications?.weeklyReport === false) {
          continue;
        }

        const tz = profile.timezone || 'UTC';
        const localHour = getLocalHour(tz);
        if (localHour !== targetHour) {
          continue;
        }

        const year = today.getFullYear();
        // Calculate ISO Week Number for unique date ID (YYYY-Www)
        const firstJan = new Date(year, 0, 1);
        const weekNum = Math.ceil((((today - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
        const weekKey = `${year}-W${weekNum}`;

        const alreadySent = await NotificationLog.findOne({
          userId,
          type: 'weekly_summary',
          date: weekKey
        });

        if (alreadySent) {
          continue;
        }

        // Gather transactions from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const summary = await Transaction.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(userId),
              type: 'expense',
              date: { $gte: sevenDaysAgo }
            }
          },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]);

        const totalSpent = summary.length > 0 ? Math.round(summary[0].totalSpent * 100) / 100 : 0;
        const count = summary.length > 0 ? summary[0].count : 0;

        const result = await notifyWeeklySummary(userId, count, totalSpent, profile.currency || 'USD');

        await NotificationLog.create({
          userId,
          type: 'weekly_summary',
          date: weekKey,
          result: result || { sent: 0, failed: 0 }
        });
      } catch (err) {
        logger.error(`[Scheduler] Error processing weekly summary for user ${userId}:`, err);
      }
    }
  } catch (error) {
    logger.error('[Scheduler] Weekly summary process failed:', error);
  }
}

/**
 * Re-engagement notification: runs daily at 9:00 AM.
 * Fires if the user hasn't added a transaction in the last 3 days.
 * Limit this reminder to maximum once a week.
 */
async function processInactivityReminders() {
  logger.info('[Scheduler] Running inactivity re-engagement check...');
  const UserProfile = getUserProfileModel();
  const Transaction = getTransactionModel();
  const NotificationLog = getNotificationLogModel();
  const UserDevice = getUserDeviceModel();

  try {
    const activeDevices = await UserDevice.find({ active: true }).distinct('userId');
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const year = new Date().getFullYear();
    const firstJan = new Date(year, 0, 1);
    const weekNum = Math.ceil((((new Date() - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
    const weekKey = `${year}-W${weekNum}`;

    for (const userId of activeDevices) {
      try {
        let profile = await UserProfile.findOne({ userId });
        if (!profile) continue;

        // Uses monthlyReports/billReminders/etc. or default true if not disabled explicitly
        if (profile.preferences?.notifications?.billReminders === false) {
          continue;
        }

        // Limit inactivity warnings to once per week
        const alreadySentThisWeek = await NotificationLog.findOne({
          userId,
          type: 'inactivity_reminder',
          date: weekKey
        });

        if (alreadySentThisWeek) {
          continue;
        }

        // Check if there was any transaction (income/expense) in the last 3 days
        const hasRecentTx = await Transaction.findOne({
          userId,
          date: { $gte: threeDaysAgo }
        });

        if (!hasRecentTx) {
          const result = await notifyInactiveUser(userId, profile.displayName);

          await NotificationLog.create({
            userId,
            type: 'inactivity_reminder',
            date: weekKey,
            result: result || { sent: 0, failed: 0 }
          });
        }
      } catch (err) {
        logger.error(`[Scheduler] Error processing inactivity reminder for user ${userId}:`, err);
      }
    }
  } catch (error) {
    logger.error('[Scheduler] Inactivity re-engagement process failed:', error);
  }
}

/**
 * Bootstrap and register cron jobs
 */
function initScheduler() {
  logger.info('[Scheduler] Initializing cron scheduler...');

  // 1. Process daily reminders hourly (runs at the start of every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      await processDailyReminders();
    } catch (err) {
      logger.error('[Scheduler] Hourly daily reminder cron failed:', err);
    }
  });

  // 2. Process weekly summaries hourly (filters internally for Sunday 8 PM)
  cron.schedule('30 * * * *', async () => {
    try {
      await processWeeklySummaries();
    } catch (err) {
      logger.error('[Scheduler] Hourly weekly summary cron failed:', err);
    }
  });

  // 3. Process inactivity reminders daily at 9:00 AM UTC
  cron.schedule('0 9 * * *', async () => {
    try {
      await processInactivityReminders();
    } catch (err) {
      logger.error('[Scheduler] Daily inactivity cron failed:', err);
    }
  });

  logger.info('[Scheduler] Cron scheduler registered successfully.');
}

module.exports = {
  initScheduler,
  processDailyReminders,
  processWeeklySummaries,
  processInactivityReminders,
};

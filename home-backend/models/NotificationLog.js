const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['daily_reminder', 'weekly_summary', 'streak_alert', 'inactivity_reminder'],
    },
    date: {
      type: String, // format YYYY-MM-DD or YYYY-Www (for weekly summary verification)
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    result: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness of sent notification per user per type per day/period
notificationLogSchema.index({ userId: 1, type: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);

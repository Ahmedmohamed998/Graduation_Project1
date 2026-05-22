const mongoose = require('mongoose');

/**
 * Stores FCM device tokens per user.
 * A user may have multiple devices (phone + tablet, etc.).
 */
const userDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'web', 'unknown'],
      default: 'unknown',
    },
    deviceName: {
      type: String,
      default: '',
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index: one token is unique per user
userDeviceSchema.index({ userId: 1, fcmToken: 1 }, { unique: true });

module.exports = mongoose.model('UserDevice', userDeviceSchema);

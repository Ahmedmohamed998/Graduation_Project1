const mongoose = require("mongoose");

const EmailRateLimitSchema = new mongoose.Schema({
  email: { type: String, required: true },
  ip: { type: String },
  attempts: { type: Number, default: 0 },
  lastAttempt: { type: Date, default: Date.now },
  blockedUntil: { type: Date, default: null },
});

module.exports = mongoose.model("EmailRateLimit", EmailRateLimitSchema);

const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  ip: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  subject: { type: String },
  bodyPreview: { type: String }, // first 200 chars
  status: { type: String, enum: ["sent","failed","blocked"], required: true },
  providerResponse: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("EmailLog", EmailLogSchema);

const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, index: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ip: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  replacedBy: { type: String, default: null } // token string that replaced this one (rotation)
});

RefreshTokenSchema.methods.isExpired = function () {
  return Date.now() >= this.expiresAt.getTime();
};

module.exports = mongoose.model("RefreshToken", RefreshTokenSchema);

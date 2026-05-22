// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },   // allow null for phone-only users
    phone: { type: String, unique: true, sparse: true },
    password: { type: String }, // hashed; not required for OAuth-only accounts
    googleId: { type: String },
    resetCode: { type: String },
    resetCodeExpiry: { type: Date },
    refreshToken: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

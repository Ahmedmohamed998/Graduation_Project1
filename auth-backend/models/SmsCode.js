const mongoose = require("mongoose");

const smsCodeSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  codeHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: "5m" } // auto-delete in 5 min
});

module.exports = mongoose.model("SmsCode", smsCodeSchema);

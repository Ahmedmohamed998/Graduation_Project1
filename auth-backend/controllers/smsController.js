// controllers/smsController.js
const SmsCode = require("../models/SmsCode");
const crypto = require("crypto");
const { sendSMS } = require("../utils/twilio");
const jwt = require("jsonwebtoken");

const SMS_RATE_LIMIT_SECONDS = Number(process.env.SMS_RATE_LIMIT_SECONDS) || 60;
const PHONE_VERIF_SECRET = process.env.PHONE_VERIFICATION_JWT_SECRET;
const PHONE_VERIF_EXPIRE_MINUTES = Number(process.env.PHONE_VERIFICATION_EXPIRE_MINUTES) || 10;

exports.sendCode = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

    // Rate limit check
    const lastCode = await SmsCode.findOne({ phone }).sort({ createdAt: -1 });
    if (lastCode) {
      const diffSec = (Date.now() - lastCode.createdAt) / 1000;
      if (diffSec < SMS_RATE_LIMIT_SECONDS) {
        return res.status(429).json({
          success: false,
          message: "Wait before requesting another code",
          seconds_left: Math.ceil(SMS_RATE_LIMIT_SECONDS - diffSec)
        });
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    await SmsCode.create({ phone, codeHash });

    // send SMS (Twilio)
    await sendSMS(phone, `Your verification code is: ${code}`);

    return res.json({ success: true, message: "Code sent" });
  } catch (err) {
    console.error("sendCode error:", err);
    return res.status(500).json({ success: false, message: "SMS send failed" });
  }
};

exports.verifyCode = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ success: false, message: "Phone and code required" });

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const found = await SmsCode.findOne({ phone, codeHash });

    if (!found) return res.status(400).json({ success: false, message: "Invalid or expired code" });

    // consume code (delete)
    await SmsCode.deleteMany({ phone });

    // issue phone verification JWT
    const payload = { phone, purpose: "phone_verification" };
    const token = jwt.sign(payload, PHONE_VERIF_SECRET, { expiresIn: `${PHONE_VERIF_EXPIRE_MINUTES}m` });

    return res.json({ success: true, message: "Phone verified", phoneVerificationToken: token });
  } catch (err) {
    console.error("verifyCode error:", err);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
};

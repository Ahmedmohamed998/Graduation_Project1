const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

// ── Rate limiters ──────────────────────────────────────────────────────────
// Login: max 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

// Forgot-password: max 5 requests per hour per IP
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password-reset requests. Please try again later.",
  },
});
// ──────────────────────────────────────────────────────────────────────────

const authController = require("../controllers/authController");
const smsController = require("../controllers/smsController");
const jwtMiddleware = require("../middleware/auth");

// SMS endpoints
router.post("/sms/send", smsController.sendCode);
router.post("/sms/verify", smsController.verifyCode);

// Auth endpoints
router.post("/signup", authController.signup);
router.post("/login", loginLimiter, authController.login);
router.post("/signup-phone", authController.signupWithPhone);

// Google Auth - Use the controller that creates users and returns tokens
router.post("/google-signin", authController.googleLogin);

// Password management
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  authController.forgotPassword,
);
router.post("/reset-password", authController.resetPassword);

// Token management
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);

// Email verification
router.get("/verify-email", authController.verifyEmailHTML);
router.post("/verify-email", authController.verifyEmail);

// Protected route
router.get("/me", jwtMiddleware, authController.checkAuth);

//7anshilha
router.delete("/reset-rate-limit", authController.resetRateLimit);

module.exports = router;

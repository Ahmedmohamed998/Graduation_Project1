// routes/authRoutes.js
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const {
  login,
  signup,
  googleLogin,
  forgotPassword,
  resetPassword,
  sendEmailVerification
} = require("../controllers/authController");

// Import Middlewares correctly from the exported object
const { jwtMiddleware, verifyEmail } = require("../middleware/auth");

// ====================== PUBLIC ROUTES (No authentication needed) ======================
router.post("/login", login);
router.post("/signup", signup);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/send-email-code", sendEmailVerification);
// POST /api/auth/register
router.post("/register", authController.register);

// Email Verification (Public route)
router.post("/verify-email", authController.verifyEmail);

// ====================== PROTECTED ROUTES (JWT + Email Verified) ======================

// Apply both middlewares to all protected routes
router.use(jwtMiddleware);      // First: Authenticate user
router.use(verifyEmail);        // Second: Check if email is verified

// Now all routes below this will require login + verified email
router.get("/me", authController.checkAuth);                    
router.get("/profile", authController.checkAuth);               

module.exports = router;
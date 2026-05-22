// // router.post("/google", googleLogin);

// const express = require("express");
// const router = express.Router();

// // Import controllers
// const {
//   sendEmailVerification,
//   forgotPassword,
//   googleLogin   // ← make sure this function exists in authController!
// } = require("../controllers/authController");

// //Routes
// router.post("/send-email-code", sendEmailVerification);

// router.post("/forgot-password", forgotPassword);

// router.post("/google", googleLogin);

// module.exports = router;









// routes/authRoutes.js

const express = require("express");
const router = express.Router();
const {
  login,
  signup,
  googleLogin,
  forgotPassword,
  resetPassword,
  sendEmailVerification
} = require("../controllers/authController");

// Public routes
router.post("/login", login);
router.post("/signup", signup);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/send-email-code", sendEmailVerification);

module.exports = router;
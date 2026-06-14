// controllers/authController.js
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const EmailLog = require("../models/EmailLog");
const EmailRateLimit = require("../models/EmailRateLimit");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/token");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// JWT Secrets
const PHONE_VERIF_SECRET = process.env.PHONE_VERIFICATION_JWT_SECRET;
const APP_JWT_SECRET = process.env.JWT_SECRET;

// Helper: Create refresh token document
const createRefreshToken = async (userId, metadata = {}) => {
  const token = signRefreshToken({ id: userId });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const refreshToken = await RefreshToken.create({
    token,
    user: userId,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    expiresAt
  });

  return refreshToken;
};

// Helper: Email rate limiting
const checkEmailRateLimit = async (email, ip) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Check if blocked
  const existingBlock = await EmailRateLimit.findOne({
    $or: [{ email }, { ip }],
    blockedUntil: { $gt: now }
  });

  if (existingBlock) {
    return {
      allowed: false,
      reason: "Too many attempts. Please try again later."
    };
  }

  // Get recent attempts
  const recentAttempts = await EmailRateLimit.find({
    $or: [{ email }, { ip }],
    lastAttempt: { $gte: oneHourAgo }
  });

  const maxAttempts = 5;

  if (recentAttempts.length >= maxAttempts) {
    // Block for 1 hour
    const blockedUntil = new Date(now.getTime() + 60 * 60 * 1000);
    await EmailRateLimit.updateMany(
      { $or: [{ email }, { ip }] },
      { blockedUntil }
    );

    return {
      allowed: false,
      reason: "Too many attempts. Please try again in 1 hour."
    };
  }

  // Record this attempt
  await EmailRateLimit.create({
    email,
    ip,
    attempts: recentAttempts.length + 1,
    lastAttempt: now
  });

  return { allowed: true };
};

// Helper to validate phone verification token
function verifyPhoneVerificationToken(token, phone) {
  try {
    const payload = jwt.verify(token, PHONE_VERIF_SECRET);
    if (payload && payload.purpose === "phone_verification" && payload.phone === phone) {
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

// ==================== PHONE VERIFICATION SIGNUP ====================
exports.signupWithPhone = async (req, res) => {
  try {
    const { username, email, phone, password, confirmPassword, phoneVerificationToken } = req.body;

    if (!username || !phone || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Username, phone, password, and confirmPassword are required."
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters."
      });
    }

    // Verify phone token
    if (!phoneVerificationToken || !verifyPhoneVerificationToken(phoneVerificationToken, phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing phone verification token."
      });
    }

    // Check duplicates
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email already registered."
        });
      }
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: "Phone number already in use."
      });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email: email || undefined,
      phone,
      password: hashedPassword
    });

    // Generate tokens
    const accessToken = signAccessToken({ id: newUser._id });
    const refreshTokenDoc = await createRefreshToken(newUser._id, {
      ip: req.ip,
      userAgent: req.get("User-Agent") || ""
    });

    if (process.env.USE_REFRESH_COOKIE === "true") {
      res.cookie("refreshToken", refreshTokenDoc.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.status(201).json({
        success: true,
        message: "Account created successfully.",
        accessToken,
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          phone: newUser.phone
        }
      });
    } else {
      return res.status(201).json({
        success: true,
        message: "Account created successfully.",
        accessToken,
        refreshToken: refreshTokenDoc.token,
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          phone: newUser.phone
        }
      });
    }

  } catch (err) {
    console.error("Phone verification signup error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: err.message
    });
  }
};

// ==================== FLEXIBLE LOGIN ====================
exports.login = async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required."
      });
    }

    let user;
    if (identifier) {
      // identifier may be email or phone
      user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    } else if (email) {
      user = await User.findOne({ email });
    } else if (phone) {
      user = await User.findOne({ phone });
    } else {
      return res.status(400).json({
        success: false,
        message: "Provide email, phone, or identifier."
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }
    // --- PROTECT UNVERIFIED ACCOUNTS FROM LOGGING IN ---
    if (user.email && !user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Your email address is not verified. Please check your inbox."
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account has no password. Use OAuth or reset password."
      });
    }


    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password."
      });
    }

    // Generate tokens
    const accessToken = signAccessToken({ id: user._id });
    const refreshTokenDoc = await createRefreshToken(user._id, {
      ip: req.ip,
      userAgent: req.get("User-Agent") || ""
    });

    if (process.env.USE_REFRESH_COOKIE === "true") {
      res.cookie("refreshToken", refreshTokenDoc.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: "Login successful.",
        accessToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          phone: user.phone
        }
      });
    } else {
      return res.json({
        success: true,
        message: "Login successful.",
        accessToken,
        refreshToken: refreshTokenDoc.token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          phone: user.phone
        }
      });
    }

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: err.message
    });
  }
};


// ==================== EMAIL-BASED SIGNUP ====================
exports.signup = async (req, res) => {
  try {
    const { username, email, phone, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and passwords are required."
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters."
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }].filter(Boolean)
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({
          success: false,
          message: "Email already registered."
        });
      }
      if (phone && existingUser.phone === phone) {
        return res.status(409).json({
          success: false,
          message: "Phone number already in use."
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token before saving
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = Date.now() + 3600000; // 1 hour

    const newUser = await User.create({
      username,
      email,
      phone: phone || undefined,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: tokenExpiry
    });

    // Send verification email
    // Use the API route directly to handle the GET request and render the HTML page
    const baseUrl = process.env.BACKEND_URL || 'https://hasibha.online';
    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
    const emailText = `Hello ${username},\n\nPlease verify your account using this link: ${verificationLink}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
        <h2 style="color: #4CAF50;">Welcome to Hasibha!</h2>
        <p>Please click the button below to verify your email address:</p>
        <a href="${verificationLink}" style="padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px; font-weight: bold;">Verify Email</a>
        <p style="margin-top: 20px; font-size: 12px; color: #777;">If the button doesn't work, copy and paste this link into your browser:<br>${verificationLink}</p>
      </div>
    `;

    try {
      await sendEmail(email, "Verify Your Email Address", emailText, emailHtml);
    } catch (emailErr) {
      console.error("Signup email delivery failed:", emailErr.message);
      // Signup still completes — user can request a resend later
    }

    // No tokens issued until email is verified
    return res.status(201).json({
      success: true,
      message: "Registration successful. Please check your inbox to verify your email.",
      requiresVerification: true,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });

  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: err.message
    });
  }
};

// ==================== GOOGLE AUTHENTICATION ====================
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required."
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google token."
      });
    }

    const { sub: googleId, email, name, email_verified } = payload;

    if (!email_verified) {
      return res.status(403).json({
        success: false,
        message: "Google account email not verified."
      });
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email }]
    });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.username && name) {
          user.username = name;
        }
        await user.save();
      }
    } else {
      user = await User.create({
        username: name || email.split("@")[0],
        email,
        password: "",
        googleId
      });
    }

    // Generate tokens
    const accessToken = signAccessToken({ id: user._id });
    const refreshTokenDoc = await createRefreshToken(user._id, {
      ip: req.ip,
      userAgent: req.get("User-Agent") || ""
    });

    if (process.env.USE_REFRESH_COOKIE === "true") {
      res.cookie("refreshToken", refreshTokenDoc.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        message: "Google authentication successful.",
        accessToken,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          phone: user.phone
        }
      });
    } else {
      return res.json({
        success: true,
        message: "Google authentication successful.",
        accessToken,
        refreshToken: refreshTokenDoc.token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          phone: user.phone
        }
      });
    }

  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(500).json({
      success: false,
      message: "Google authentication failed.",
      error: err.message
    });
  }
};


// ==================== FORGOT PASSWORD ====================
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const ip = req.ip;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required."
      });
    }

    // Rate limiting check
    const rateLimitCheck = await checkEmailRateLimit(email, ip);
    if (!rateLimitCheck.allowed) {
      return res.json({
        success: false,
        message: rateLimitCheck.reason || "Too many attempts. Please try again later."
      });
    }

    const user = await User.findOne({ email });

    // === NEW BEHAVIOR: Different message if email not found ===
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address. Please check the email or sign up first."
      });
    }

    // Create email log
    const emailLog = await EmailLog.create({
      email,
      ip,
      user: user._id,
      subject: "Password Reset Code",
      bodyPreview: "Your password reset code",
      status: "sent"
    });

    // Generate reset code
    const resetCode = crypto.randomInt(100000, 1000000).toString();
    console.log("Generated OTP:", resetCode);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetCode = resetCode;
    user.resetCodeExpiry = expiry;
    await user.save();

    // Send email
    const emailText = `Your password reset code is: ${resetCode}\n\nIt expires in 10 minutes.`;
    const emailHtml = `
      <div>
        <h2>Password Reset Request</h2>
        <p>Your password reset code is: <strong>${resetCode}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    try {
      const sent = await sendEmail(
        email,
        "Your Password Reset Code",
        emailText,
        emailHtml
      );
      emailLog.status = sent ? "sent" : "failed";
      emailLog.providerResponse = sent ? { success: true } : { message: "sendEmail returned false" };
    } catch (emailErr) {
      console.error("Forgot password — email send error:", emailErr.message);
      emailLog.status = "failed";
      emailLog.providerResponse = { error: emailErr.message };
    }
    await emailLog.save();

    return res.status(200).json({
      success: true,
      message: "A reset code has been sent to your email."
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later."
    });
  }
};


// ==================== RESET PASSWORD ====================
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code and new password are required."
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters."
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (user.resetCode !== code) {
      return res.status(400).json({
        success: false,
        message: "Invalid code."
      });
    }

    if (!user.resetCodeExpiry || user.resetCodeExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Code expired."
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetCode = null;
    user.resetCodeExpiry = null;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successful."
    });

  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: err.message
    });
  }
};

// ==================== REFRESH TOKEN ====================
exports.refreshToken = async (req, res) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Refresh token missing"
      });
    }

    // Verify JWT first
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
    }

    const existing = await RefreshToken.findOne({ token });

    if (!existing) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found"
      });
    }

    if (existing.revoked) {
      return res.status(401).json({
        success: false,
        message: "Refresh token revoked"
      });
    }

    if (existing.isExpired()) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired"
      });
    }

    // Token rotation: create new refresh token
    const newRefresh = await createRefreshToken(existing.user, {
      ip: req.ip,
      userAgent: req.get("User-Agent") || ""
    });

    // Revoke old token
    existing.revoked = true;
    existing.replacedBy = newRefresh.token;
    await existing.save();

    // Generate new access token
    const accessToken = signAccessToken({ id: existing.user });

    if (process.env.USE_REFRESH_COOKIE === "true") {
      res.cookie("refreshToken", newRefresh.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        accessToken
      });
    } else {
      return res.json({
        success: true,
        accessToken,
        refreshToken: newRefresh.token
      });
    }
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// ==================== LOGOUT ====================
exports.logout = async (req, res) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;

    if (token) {
      const rt = await RefreshToken.findOne({ token });
      if (rt) {
        rt.revoked = true;
        await rt.save();
      }
    }

    // Clear cookie
    res.clearCookie("refreshToken");

    return res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// ==================== CHECK AUTH STATUS ====================
exports.checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error("Check auth error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: err.message
    });
  }
};


//7anshilha
// ==================== RESET RATE LIMIT (FOR TESTING) ====================
exports.resetRateLimit = async (req, res) => {
  try {
    await EmailRateLimit.deleteMany({});
    console.log("Rate limit records cleared");

    return res.json({
      success: true,
      message: "Rate limits reset successfully. You can now test again."
    });
  } catch (err) {
    console.error("Reset rate limit error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reset rate limits",
      error: err.message
    });
  }
};


// Email Verification Function (JSON)
async function verifyEmail(req, res) {
  const { token } = req.body;
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) return res.status(400).json({ error: "Invalid/expired token" });

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({ message: "Email verified successfully" });
}

// Email Verification Function (HTML Page Redirect)
async function verifyEmailHTML(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.send(renderVerificationPage(false, "No verification token provided."));
  }

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.send(renderVerificationPage(false, "Invalid or expired verification link. Please request a new one."));
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.send(renderVerificationPage(true, "Your email has been verified successfully!"));
  } catch (err) {
    console.error("HTML Email verification error:", err);
    return res.send(renderVerificationPage(false, "An error occurred during verification. Please try again later."));
  }
}

// Helper to render the HTML page
function renderVerificationPage(success, message) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hasibha Track - Email Verification</title>
  
  <!-- Modern Google Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-color: #f8fafc;
      --card-bg: rgba(255, 255, 255, 0.85);
      --card-border: rgba(226, 232, 240, 0.8);
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --primary: #10B981;
      --primary-hover: #059669;
      --primary-light: rgba(16, 185, 129, 0.1);
      --error: #ef4444;
      --error-hover: #dc2626;
      --error-light: rgba(239, 68, 68, 0.1);
      --spinner-bg: #e2e8f0;
      --shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
      --glow-success: rgba(16, 185, 129, 0.2);
      --glow-error: rgba(239, 68, 68, 0.2);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #0b0f19;
        --card-bg: rgba(17, 24, 39, 0.8);
        --card-border: rgba(31, 41, 55, 0.8);
        --text-primary: #f9fafb;
        --text-secondary: #9ca3af;
        --primary: #10B981;
        --primary-hover: #34d399;
        --primary-light: rgba(16, 185, 129, 0.15);
        --error: #f87171;
        --error-hover: #fca5a5;
        --error-light: rgba(248, 113, 113, 0.15);
        --spinner-bg: #1f2937;
        --shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        --glow-success: rgba(16, 185, 129, 0.1);
        --glow-error: rgba(248, 113, 113, 0.1);
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-primary);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      overflow-x: hidden;
      transition: background-color 0.5s ease;
    }

    /* Background decorative blobs */
    .blob {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.15;
      z-index: 0;
      pointer-events: none;
    }
    .blob-1 {
      top: -10%;
      left: -10%;
      background: var(--primary);
    }
    .blob-2 {
      bottom: -10%;
      right: -10%;
      background: #0d9488;
    }

    .container {
      position: relative;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 50px 40px;
      border-radius: 24px;
      box-shadow: var(--shadow);
      text-align: center;
      max-width: 460px;
      width: 100%;
      z-index: 1;
      transform: translateY(20px);
      opacity: 0;
      animation: cardEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      will-change: transform, opacity;
    }

    @keyframes cardEntrance {
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 35px;
      opacity: 0;
      animation: fadeIn 0.8s ease 0.2s forwards;
    }

    .logo-container {
      position: relative;
      margin-bottom: 12px;
      transition: transform 0.3s ease;
    }
    .logo-container:hover {
      transform: scale(1.05);
    }

    .brand-name {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, var(--primary), #0d9488);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-top: 4px;
    }

    .status-view {
      display: none;
      opacity: 0;
      transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      transform: scale(0.95);
    }

    .status-view.active {
      display: block;
      opacity: 1;
      transform: scale(1);
    }

    /* Illustrated States styling */
    .icon-wrapper {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .success-bg {
      background-color: var(--primary-light);
      box-shadow: 0 0 30px var(--glow-success);
    }

    .error-bg {
      background-color: var(--error-light);
      box-shadow: 0 0 30px var(--glow-error);
    }

    h1 {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }

    p {
      font-size: 15px;
      line-height: 1.6;
      color: var(--text-secondary);
      margin-bottom: 32px;
      padding: 0 10px;
    }

    /* Progressive loading state elements */
    .loader-ring {
      border: 4px solid var(--spinner-bg);
      border-top: 4px solid var(--primary);
      border-radius: 50%;
      width: 64px;
      height: 64px;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .progress-track {
      width: 100%;
      height: 6px;
      background: var(--spinner-bg);
      border-radius: 10px;
      margin: 20px auto 30px;
      overflow: hidden;
      max-width: 240px;
    }

    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--primary), #0d9488);
      border-radius: 10px;
      transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Buttons and Links */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      outline: none;
    }

    .btn:focus-visible {
      box-shadow: 0 0 0 3px var(--bg-color), 0 0 0 5px var(--primary);
    }

    .btn-primary {
      background-color: var(--primary);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }

    .btn-primary:hover {
      background-color: var(--primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
    }

    .btn-primary:active {
      transform: translateY(0);
    }

    .btn-error {
      background-color: var(--error);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }

    .btn-error:hover {
      background-color: var(--error-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.3);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--card-border);
      margin-top: 12px;
    }

    .btn-secondary:hover {
      background: var(--spinner-bg);
      color: var(--text-primary);
    }

    /* SVGs draw check & cross animations */
    .checkmark-path {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: drawCheck 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
    }

    .cross-path-1 {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: drawCross 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
    }

    .cross-path-2 {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: drawCross 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
    }

    @keyframes drawCheck {
      to { stroke-dashoffset: 0; }
    }

    @keyframes drawCross {
      to { stroke-dashoffset: 0; }
    }

    @keyframes fadeIn {
      to { opacity: 1; }
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  </style>
</head>
<body>

  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>

  <main class="container" aria-live="polite">
    <!-- Brand Header -->
    <header class="brand">
      <div class="logo-container">
        <!-- High fidelity SVG application logo -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="76" height="76">
          <defs>
            <linearGradient id="limeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#34D399" />
              <stop offset="100%" stop-color="#10B981" />
            </linearGradient>
            <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0D9488" />
              <stop offset="100%" stop-color="#0F766E" />
            </linearGradient>
            <linearGradient id="darkTealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0F766E" />
              <stop offset="100%" stop-color="#030712" />
            </linearGradient>
          </defs>
          <!-- Background Lime Green Fold -->
          <path d="M 28 15 C 38 15, 82 10, 82 10 C 82 10, 64 35, 49 60 C 41 72, 38 92, 38 92 C 38 92, 22 80, 22 60 C 22 40, 23 20, 28 15 Z" fill="url(#limeGrad)" />
          <!-- Main Teal Sheet -->
          <path d="M 42 20 C 56 20, 94 15, 94 15 C 94 15, 94 50, 94 70 C 94 88, 84 98, 68 98 C 54 98, 48 88, 48 78 C 48 68, 48 48, 38 35 C 34 28, 32 22, 42 20 Z" fill="url(#tealGrad)" />
          <!-- Bottom-left Curl in Dark Teal -->
          <path d="M 28 68 C 28 58, 44 58, 47 68 C 49 73, 47 88, 37 94 C 28 98, 15 90, 15 78 C 15 68, 22 68, 28 68 Z" fill="url(#darkTealGrad)" />
          <!-- Three White Dots -->
          <circle cx="56" cy="30" r="3" fill="#FFFFFF" />
          <circle cx="68" cy="29" r="3" fill="#FFFFFF" />
          <circle cx="80" cy="28" r="3" fill="#FFFFFF" />
          <!-- White Checkmark -->
          <path d="M 60 55 L 70 65 L 88 42" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="brand-name">Hasibha Track</div>
    </header>

    <!-- State 1: Loading (Verifying) -->
    <div id="view-loading" class="status-view active">
      <div class="loader-ring" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div>
      <h1>Verifying Account</h1>
      <p>Please wait while we verify your email address and secure your account access.</p>
      <div class="progress-track">
        <div class="progress-bar" id="load-progress"></div>
      </div>
    </div>

    <!-- State 2: Success -->
    <div id="view-success" class="status-view">
      <div class="icon-wrapper success-bg">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" class="checkmark-path"></polyline>
        </svg>
      </div>
      <h1>Email Verified!</h1>
      <p id="success-msg">${message}</p>
      <a href="hasibha://login" class="btn btn-primary" id="btn-continue-app">Open Application</a>
      <a href="/" class="btn btn-secondary">Go to Website</a>
    </div>

    <!-- State 3: Error -->
    <div id="view-error" class="status-view">
      <div class="icon-wrapper error-bg">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" class="cross-path-1"></line>
          <line x1="6" y1="6" x2="18" y2="18" class="cross-path-2"></line>
        </svg>
      </div>
      <h1 id="error-title">Verification Failed</h1>
      <p id="error-msg">${message}</p>
      <button class="btn btn-error" id="btn-retry" onclick="window.location.reload();">Retry Verification</button>
      <a href="mailto:support@hasibha.online" class="btn btn-secondary">Contact Support</a>
    </div>
  </main>

  <script>
    document.addEventListener("DOMContentLoaded", () => {
      const isSuccess = ${success};
      const loadBar = document.getElementById("load-progress");
      
      // Animate the loading indicator
      setTimeout(() => {
        if (loadBar) loadBar.style.width = "100%";
      }, 50);

      // Perform a smooth transition after progress bar completes
      setTimeout(() => {
        const loadingView = document.getElementById("view-loading");
        loadingView.classList.remove("active");

        setTimeout(() => {
          loadingView.style.display = "none";
          if (isSuccess) {
            const successView = document.getElementById("view-success");
            successView.style.display = "block";
            // Trigger reflow for animation
            successView.offsetHeight;
            successView.classList.add("active");
            
            // Auto redirect to mobile app deep link if successful
            setTimeout(() => {
              window.location.href = "hasibha://login";
            }, 2000);
          } else {
            const errorView = document.getElementById("view-error");
            errorView.style.display = "block";
            errorView.offsetHeight;
            errorView.classList.add("active");
          }
        }, 300);
      }, 1400);
    });
  </script>
</body>
</html>
  `;
}


module.exports = {
  ...exports,
  verifyEmail,
  verifyEmailHTML,
  register: exports.signup,
  sendEmailVerification: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: "Email is required." });

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(200).json({ success: true, message: "If an account exists, a link has been sent." });
      }

      if (user.emailVerified) {
        return res.status(400).json({ success: false, message: "Email is already verified." });
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = Date.now() + 3600000;
      await user.save();

      const baseUrl = process.env.BACKEND_URL || 'https://hasibha.online';
      const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
      await sendEmail(
        email,
        "Verify Your Email Address",
        `Hello ${user.username},\n\nPlease verify your account using this link: ${verificationLink}`,
        `
          <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
            <h2 style="color: #4CAF50;">Welcome to Hasibha!</h2>
            <p>Please click the button below to verify your email address:</p>
            <a href="${verificationLink}" style="padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px; font-weight: bold;">Verify Email</a>
            <p style="margin-top: 20px; font-size: 12px; color: #777;">If the button doesn't work, copy and paste this link into your browser:<br>${verificationLink}</p>
          </div>
        `
      );

      res.status(200).json({ success: true, message: "Verification email sent." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
};
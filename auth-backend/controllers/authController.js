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
      email: email || null,
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
      phone: phone || "",
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
        phone: "",
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
      return res.json({
        success: true,
        message: "a reset code has been sent."
      });
    }

    // Rate limiting check
    const rateLimitCheck = await checkEmailRateLimit(email, ip);
    if (!rateLimitCheck.allowed) {
      return res.json({
        success: true,
        message: "a reset code has been sent."
      });
    }

    const user = await User.findOne({ email });
    
    // Create email log (pending)
    const emailLog = await EmailLog.create({
      email,
      ip,
      user: user?._id || null,
      subject: "Password Reset Code",
      bodyPreview: "Your password reset code",
      status: "sent"
    });

    if (!user) {
      // Update email log
      emailLog.status = "failed";
      emailLog.providerResponse = { message: "User not found" };
      await emailLog.save();

      // Don't reveal whether email exists
      return res.json({
        success: true,
        message: "a reset code has been sent."
      });
    }

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

    // Wrap email send so transport failures never change the response shape
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
      console.error("Forgot password — email send error (silent):", emailErr.message);
      emailLog.status = "failed";
      emailLog.providerResponse = { error: emailErr.message };
    }
    await emailLog.save();

    // Always return the same generic 200 — never reveal whether the email exists
    return res.status(200).json({
      success: true,
      message: "a reset code has been sent."
    });

  } catch (err) {
    // Swallow internal errors silently — returning a 500 would leak a different
    // response shape that could be used for user enumeration.
    console.error("Forgot password error:", err);
    return res.status(200).json({
      success: true,
      message: "a reset code has been sent."
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
  const bgColor = "#ffffff";
  const primaryColor = "#4CAF50"; // Hasibha Green
  const textColor = "#333333";
  const icon = success ? "✅" : "❌";
  const title = success ? "Verified!" : "Verification Failed";
  const buttonColor = success ? primaryColor : "#d32f2f";
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hasibha - Email Verification</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f9f9f9;
          color: ${textColor};
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          background-color: ${bgColor};
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          width: 90%;
          border-top: 6px solid ${buttonColor};
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: ${primaryColor};
          margin-bottom: 20px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 10px;
        }
        h1 {
          margin: 10px 0;
          font-size: 24px;
        }
        p {
          font-size: 16px;
          color: #666;
          margin-bottom: 30px;
          line-height: 1.5;
        }
        .btn {
          display: inline-block;
          background-color: ${primaryColor};
          color: #ffffff;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: bold;
          transition: background-color 0.3s;
        }
        .btn:hover {
          background-color: #388E3C;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Hasibha</div>
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="https://hasibha.online" class="btn">Go to App</a>
      </div>
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
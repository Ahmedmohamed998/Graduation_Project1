const { verifyAccessToken } = require("../utils/token");
const User = require("../models/User");

async function jwtMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided." });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }

    const user = await User.findById(payload.id).select("-password");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    console.error("jwtMiddleware error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
}

const verifyEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  if (!req.user.emailVerified && req.user.emailVerified !== undefined) {
    return res.status(403).json({ 
      success: false, 
      message: "Email not verified. Please verify your email first." 
    });
  }

  next();
};

// Standardizing export to support both ways people import it
module.exports = {
  jwtMiddleware,
  verifyToken: jwtMiddleware, // Alias for security
  verifyEmail
};
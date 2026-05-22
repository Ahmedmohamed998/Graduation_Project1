const { verifyAccessToken } = require("../utils/token");
const User = require("../models/User");

async function jwtMiddleware(req, res, next) {
  try {
    // Common patterns: Authorization header "Bearer <token>"
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

    // Optionally attach full user
    const user = await User.findById(payload.id).select("-password");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    req.user = user;    // now protected handlers can use req.user
    req.userId = user._id; // for controllers expecting userId
    next();
  } catch (err) {
    console.error("jwtMiddleware error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
}


module.exports = jwtMiddleware;
module.exports.verifyToken = jwtMiddleware;
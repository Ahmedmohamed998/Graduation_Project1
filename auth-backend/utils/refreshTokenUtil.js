const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

function generateRandomTokenString() {
  return crypto.randomBytes(48).toString("hex");
}

async function createRefreshToken(userId, { ip, userAgent }) {
  const tokenStr = generateRandomTokenString();
  const expiresIn = process.env.JWT_REFRESH_EXPIRES || "30d";
  // convert expiresIn to ms (simple support for days e.g. "30d")
  let ms;
  if (expiresIn.endsWith("d")) {
    const days = parseInt(expiresIn.slice(0, -1), 10);
    ms = days * 24 * 60 * 60 * 1000;
  } else {
    ms = 30 * 24 * 60 * 60 * 1000;
  }
  const expiresAt = new Date(Date.now() + ms);

  const refresh = await RefreshToken.create({
    token: tokenStr,
    user: userId,
    ip,
    userAgent,
    expiresAt
  });

  return refresh;
}

module.exports = { createRefreshToken, generateRandomTokenString };

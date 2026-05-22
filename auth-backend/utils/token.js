// // utils/token.js
// const jwt = require("jsonwebtoken");

// function signAccessToken(payload) {
//   return jwt.sign(payload, process.env.JWT_SECRET, {
//     expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m"
//   });
// }

// function verifyAccessToken(token) {
//   return jwt.verify(token, process.env.JWT_SECRET);
// }

// module.exports = { signAccessToken, verifyAccessToken };










// utils/token.js
const jwt = require("jsonwebtoken");

const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m"
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || "30d"
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken
};
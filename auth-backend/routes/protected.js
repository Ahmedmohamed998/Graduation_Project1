// routes/protected.js
const express = require("express");
const router = express.Router();
const { jwtMiddleware } = require("../middleware/auth");

router.get("/profile", jwtMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
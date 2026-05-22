const express = require("express");
const router = express.Router();
const smsController = require("../controllers/smsController");

router.post("/send", smsController.sendCode);
router.post("/verify", smsController.verifyCode);

module.exports = router;

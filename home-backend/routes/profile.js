const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getProfile, updateProfile } = require('../controllers/profileController');

router.use(verifyToken);

router.get('/', getProfile);
router.put('/', updateProfile);

module.exports = router;

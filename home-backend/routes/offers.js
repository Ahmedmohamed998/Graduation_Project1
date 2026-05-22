const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getOffers, createOffer } = require('../controllers/offersController');

router.use(verifyToken);

router.get('/', getOffers);
router.post('/', createOffer); // For admin/testing

module.exports = router;

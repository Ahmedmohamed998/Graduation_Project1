const express = require('express');
const router = express.Router();
const helpController = require('../controllers/helpController');

// Get all help articles
router.get('/', helpController.getAllHelp);

// Get help by category
router.get('/category/:category', helpController.getHelpByCategory);

// Get FAQ
router.get('/faq', helpController.getFAQ);

// Get single article
router.get('/:id', helpController.getHelpArticle);

// Contact support
router.post('/contact', helpController.contactSupport);

module.exports = router;

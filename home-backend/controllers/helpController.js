const HelpContent = require('../models/HelpContent');

// Get all help articles
exports.getAllHelp = async (req, res) => {
    try {
        const { category, search } = req.query;

        let query = { isActive: true };

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        const articles = await HelpContent.find(query)
            .sort({ category: 1, order: 1 })
            .select('-__v');

        res.json({
            total: articles.length,
            articles
        });
    } catch (error) {
        console.error('Get all help error:', error);
        res.status(500).json({ error: 'Failed to get help articles' });
    }
};

// Get help by category
exports.getHelpByCategory = async (req, res) => {
    try {
        const { category } = req.params;

        const articles = await HelpContent.find({ category, isActive: true })
            .sort({ order: 1 })
            .select('-__v');

        res.json({
            category,
            total: articles.length,
            articles
        });
    } catch (error) {
        console.error('Get help by category error:', error);
        res.status(500).json({ error: 'Failed to get help articles' });
    }
};

// Get single help article
exports.getHelpArticle = async (req, res) => {
    try {
        const { id } = req.params;

        const article = await HelpContent.findById(id)
            .populate('relatedArticles', 'title category')
            .select('-__v');

        if (!article) {
            return res.status(404).json({ error: 'Help article not found' });
        }

        res.json(article);
    } catch (error) {
        console.error('Get help article error:', error);
        res.status(500).json({ error: 'Failed to get help article' });
    }
};

// Get FAQ
exports.getFAQ = async (req, res) => {
    try {
        const faqs = await HelpContent.find({ category: 'faq', isActive: true })
            .sort({ order: 1 })
            .select('-__v');

        res.json({
            total: faqs.length,
            faqs
        });
    } catch (error) {
        console.error('Get FAQ error:', error);
        res.status(500).json({ error: 'Failed to get FAQ' });
    }
};

// Contact support (just logs for now, can integrate email later)
exports.contactSupport = async (req, res) => {
    try {
        const { subject, message } = req.body;
        const userId = req.userId;

        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        // Log support request (in production, send email or save to database)
        console.log('Support Request:', {
            userId,
            subject,
            message,
            timestamp: new Date()
        });

        res.json({
            message: 'Your message has been sent to support. We will get back to you soon.'
        });
    } catch (error) {
        console.error('Contact support error:', error);
        res.status(500).json({ error: 'Failed to send support message' });
    }
};

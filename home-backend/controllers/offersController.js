const Offer = require('../models/Offer');
const logger = require('../utils/logger');

/**
 * GET /api/offers
 * Get active and valid offers
 */
const getOffers = async (req, res, next) => {
    try {
        const userId = req.userId;
        const now = new Date();

        // Find offers that are active and still valid
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now }
        }).sort({ createdAt: -1 });

        // Filter offers for 'all' users or specific targeting could be added here
        // For now, return all active offers
        const availableOffers = offers.filter(offer =>
            offer.targetUsers.includes('all')
        );

        res.status(200).json({
            offers: availableOffers,
            count: availableOffers.length
        });
    } catch (error) {
        logger.error('Error fetching offers:', error);
        next(error);
    }
};

/**
 * POST /api/offers (Admin only - for future)
 * Create a new offer
 */
const createOffer = async (req, res, next) => {
    try {
        const {
            title,
            description,
            category,
            discountPercentage,
            discountAmount,
            imageUrl,
            validUntil,
            targetUsers,
            merchantName,
            merchantUrl
        } = req.body;

        if (!title || !description || !category || !validUntil) {
            return res.status(400).json({
                error: 'Title, description, category, and valid until date are required'
            });
        }

        const offer = await Offer.create({
            title,
            description,
            category,
            discountPercentage,
            discountAmount,
            imageUrl,
            validUntil,
            targetUsers: targetUsers || ['all'],
            merchantName,
            merchantUrl
        });

        logger.info(`Offer created: ${title}`);

        res.status(201).json({
            message: 'Offer created successfully',
            offer
        });
    } catch (error) {
        logger.error('Error creating offer:', error);
        next(error);
    }
};

module.exports = {
    getOffers,
    createOffer
};

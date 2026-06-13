const UserProfile = require('../models/UserProfile');
const logger = require('../utils/logger');

/**
 * GET /api/profile
 * Get user profile
 */
const getProfile = async (req, res, next) => {
    try {
        const userId = req.userId;

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            const User = require('../models/User');
            const user = await User.findById(userId);
            const username = user && user.username ? user.username : 'User';

            profile = await UserProfile.create({
                userId,
                displayName: username,
                profilePhoto: ''
            });
        }

        res.status(200).json(profile);
    } catch (error) {
        logger.error('Error fetching profile:', error);
        next(error);
    }
};

/**
 * PUT /api/profile
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { displayName, profilePhoto, currency } = req.body;

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            profile = await UserProfile.create({
                userId,
                displayName,
                profilePhoto,
                currency
            });
        } else {
            if (displayName !== undefined) profile.displayName = displayName;
            if (profilePhoto !== undefined) profile.profilePhoto = profilePhoto;
            if (currency !== undefined) profile.currency = currency;

            await profile.save();
        }

        logger.info(`Profile updated for user ${userId}`);

        res.status(200).json({
            message: 'Profile updated successfully',
            profile
        });
    } catch (error) {
        logger.error('Error updating profile:', error);
        next(error);
    }
};

module.exports = {
    getProfile,
    updateProfile
};

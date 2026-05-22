const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware to verify JWT token
 * Extracts userId from token and attaches to request object
 */
const verifyToken = (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('No token provided in request');
            return res.status(401).json({
                error: 'Access denied. No token provided.'
            });
        }

        // Extract token
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user ID to request
        req.userId = decoded.userId || decoded.id;

        logger.debug(`Token verified for user: ${req.userId}`);

        next();
    } catch (error) {
        logger.error(`Token verification failed: ${error.message}`);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired. Please login again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token.'
            });
        }

        return res.status(401).json({
            error: 'Token verification failed.'
        });
    }
};

module.exports = verifyToken;

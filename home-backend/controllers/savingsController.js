const mongoose    = require('mongoose');
const SavingsGoal = require('../models/SavingsGoal');
const logger      = require('../utils/logger');
const { notifyGoalCompleted, notifyGoalMilestone } = require('../utils/notifications');

/**
 * POST /api/savings
 * Create a new savings goal
 */
const createSavingsGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { name, targetAmount, deadline, icon, priority, description } = req.body;

        if (!name || !targetAmount) {
            return res.status(400).json({ error: 'Name and target amount are required' });
        }

        const savingsGoal = await SavingsGoal.create({
            userId,
            name,
            targetAmount,
            deadline,
            icon: icon || '🎯',
            priority: priority || 'medium',
            description: description || ''
        });

        logger.info(`Savings goal created: ${name} for user ${userId}`);

        res.status(201).json({
            message: 'Savings goal created successfully',
            savingsGoal
        });
    } catch (error) {
        logger.error('Error creating savings goal:', error);
        next(error);
    }
};

/**
 * GET /api/savings
 * Get all savings goals
 */
const getSavingsGoals = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { isCompleted } = req.query;

        const query = { userId };
        if (isCompleted !== undefined) query.isCompleted = isCompleted === 'true';

        const savingsGoals = await SavingsGoal.find(query).sort({ priority: 1, createdAt: -1 });

        res.status(200).json({ savingsGoals });
    } catch (error) {
        logger.error('Error fetching savings goals:', error);
        next(error);
    }
};

/**
 * GET /api/savings/:id
 * Get single savings goal
 */
const getSavingsGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const savingsGoal = await SavingsGoal.findOne({ _id: id, userId });

        if (!savingsGoal) {
            return res.status(404).json({ error: 'Savings goal not found' });
        }

        res.status(200).json(savingsGoal);
    } catch (error) {
        logger.error('Error fetching savings goal:', error);
        next(error);
    }
};

/**
 * PUT /api/savings/:id
 * Update savings goal
 */
const updateSavingsGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const savingsGoal = await SavingsGoal.findOne({ _id: id, userId });

        if (!savingsGoal) {
            return res.status(404).json({ error: 'Savings goal not found' });
        }

        const allowed = ['name', 'targetAmount', 'deadline', 'icon', 'priority', 'description'];
        const safeUpdates = {};
        allowed.forEach((k) => { if (req.body[k] !== undefined) safeUpdates[k] = req.body[k]; });
        Object.assign(savingsGoal, safeUpdates);
        await savingsGoal.save();

        logger.info(`Savings goal updated: ${id} for user ${userId}`);

        res.status(200).json({
            message: 'Savings goal updated successfully',
            savingsGoal
        });
    } catch (error) {
        logger.error('Error updating savings goal:', error);
        next(error);
    }
};

/**
 * POST /api/savings/:id/contribute
 * Add money to savings goal
 */
const contributeToGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { amount } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        const savingsGoal = await SavingsGoal.findOne({ _id: id, userId });

        if (!savingsGoal) {
            return res.status(404).json({ error: 'Savings goal not found' });
        }

        savingsGoal.savedAmount += amount;
        if (savingsGoal.savedAmount >= savingsGoal.targetAmount && !savingsGoal.isCompleted) {
            savingsGoal.isCompleted = true;
        }
        await savingsGoal.save();

        logger.info(`Contributed ${amount} to savings goal ${id} for user ${userId}`);

        // ── FCM notifications for savings milestones ───────────────────────
        const percent = Math.round((savingsGoal.savedAmount / savingsGoal.targetAmount) * 100);
        if (savingsGoal.isCompleted) {
            notifyGoalCompleted(userId, savingsGoal.name).catch(() => {});
        } else if (percent >= 75 || percent >= 50 || percent >= 25) {
            notifyGoalMilestone(userId, savingsGoal.name, percent).catch(() => {});
        }
        res.status(200).json({
            message: 'Contribution added successfully',
            savingsGoal
        });
    } catch (error) {
        logger.error('Error contributing to savings goal:', error);
        next(error);
    }
};

/**
 * DELETE /api/savings/:id
 * Delete savings goal
 */
const deleteSavingsGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const savingsGoal = await SavingsGoal.findOne({ _id: id, userId });

        if (!savingsGoal) {
            return res.status(404).json({ error: 'Savings goal not found' });
        }

        await SavingsGoal.deleteOne({ _id: id });

        logger.info(`Savings goal deleted: ${id} for user ${userId}`);

        res.status(200).json({ message: 'Savings goal deleted successfully' });
    } catch (error) {
        logger.error('Error deleting savings goal:', error);
        next(error);
    }
};

module.exports = {
    createSavingsGoal,
    getSavingsGoals,
    getSavingsGoal,
    updateSavingsGoal,
    contributeToGoal,
    deleteSavingsGoal
};

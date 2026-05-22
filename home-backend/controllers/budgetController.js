const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

/**
 * POST /api/budgets
 * Create a new budget
 */
const createBudget = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { name, category, limitAmount, period, startDate, endDate, alertThreshold } = req.body;

        if (!name || !category || !limitAmount) {
            return res.status(400).json({ error: 'Name, category, and limit amount are required' });
        }

        const budget = await Budget.create({
            userId,
            name,
            category,
            limitAmount,
            period: period || 'monthly',
            startDate: startDate || new Date(),
            endDate: endDate || new Date(new Date().setMonth(new Date().getMonth() + 1)),
            alertThreshold: alertThreshold || 80
        });

        logger.info(`Budget created: ${name} for user ${userId}`);

        res.status(201).json({
            message: 'Budget created successfully',
            budget
        });
    } catch (error) {
        logger.error('Error creating budget:', error);
        next(error);
    }
};

/**
 * GET /api/budgets
 * Get all budgets for user
 */
const getBudgets = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { isActive } = req.query;

        const query = { userId };
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const budgets = await Budget.find(query).sort({ createdAt: -1 });

        // Calculate spent amounts from transactions
        for (let budget of budgets) {
            const spent = await Transaction.aggregate([
                {
                    $match: {
                        userId: budget.userId,
                        type: 'expense',
                        category: budget.category,
                        date: { $gte: budget.startDate, $lte: budget.endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ]);

            budget.spentAmount = spent.length > 0 ? spent[0].total : 0;
            await budget.save();
        }

        res.status(200).json({ budgets });
    } catch (error) {
        logger.error('Error fetching budgets:', error);
        next(error);
    }
};

/**
 * GET /api/budgets/:id
 * Get single budget
 */
const getBudget = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const budget = await Budget.findOne({ _id: id, userId });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        res.status(200).json(budget);
    } catch (error) {
        logger.error('Error fetching budget:', error);
        next(error);
    }
};

/**
 * PUT /api/budgets/:id
 * Update budget
 */
const updateBudget = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const budget = await Budget.findOne({ _id: id, userId });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        const allowed = ['name', 'category', 'limitAmount', 'period', 'startDate', 'endDate', 'alertThreshold', 'isActive'];
        const safeUpdates = {};
        allowed.forEach((k) => { if (req.body[k] !== undefined) safeUpdates[k] = req.body[k]; });
        Object.assign(budget, safeUpdates);
        await budget.save();

        logger.info(`Budget updated: ${id} for user ${userId}`);

        res.status(200).json({
            message: 'Budget updated successfully',
            budget
        });
    } catch (error) {
        logger.error('Error updating budget:', error);
        next(error);
    }
};

/**
 * DELETE /api/budgets/:id
 * Delete budget
 */
const deleteBudget = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const budget = await Budget.findOne({ _id: id, userId });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        await Budget.deleteOne({ _id: id });

        logger.info(`Budget deleted: ${id} for user ${userId}`);

        res.status(200).json({ message: 'Budget deleted successfully' });
    } catch (error) {
        logger.error('Error deleting budget:', error);
        next(error);
    }
};

module.exports = {
    createBudget,
    getBudgets,
    getBudget,
    updateBudget,
    deleteBudget
};

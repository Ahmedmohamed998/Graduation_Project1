const mongoose    = require('mongoose');
const Transaction = require('../models/Transaction');
const Account     = require('../models/Account');
const Budget      = require('../models/Budget');
const logger      = require('../utils/logger');
const { roundToTwo }   = require('../utils/calculations');
const { notifyBudgetAlert, notifyBudgetExceeded, notifyLargeExpense } = require('../utils/notifications');

/**
 * POST /api/transactions
 * Create a new transaction
 */
const createTransaction = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { type, amount, category, categoryGroup, description, date, paymentMethod, tags, notes } = req.body;

        // Validation
        if (!type || !amount || !category) {
            return res.status(400).json({ error: 'Type, amount, and category are required' });
        }

        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Type must be either income or expense' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }

        // Create transaction
        const transaction = await Transaction.create({
            userId,
            type,
            amount: roundToTwo(amount),
            category: category.trim(),
            categoryGroup: categoryGroup ? categoryGroup.trim() : null,
            description: description || '',
            date: date || new Date(),
            paymentMethod: paymentMethod || 'cash',
            tags: tags || [],
            notes: notes || ''
        });

        // Update account balance
        let account = await Account.findOne({ userId });
        if (!account) {
            account = await Account.create({ userId, totalBalance: 0 });
        }

        if (type === 'income') {
            account.totalBalance = roundToTwo(account.totalBalance + amount);
        } else {
            account.totalBalance = roundToTwo(account.totalBalance - amount);
        }

        await account.save();

        logger.info(`Transaction created: ${type} of ${amount} for user ${userId}`);

        // ── FCM: Large-expense alert (> 500 in any currency) ──────────────
        if (type === 'expense' && amount >= 500) {
            notifyLargeExpense(userId, roundToTwo(amount), 'EGP', category).catch(() => {});
        }

        // ── FCM: Budget threshold check ───────────────────────────────────
        if (type === 'expense') {
            try {
                const now = new Date();
                const activeBudgets = await Budget.find({
                    userId,
                    category,
                    isActive: true,
                    startDate: { $lte: now },
                    endDate:   { $gte: now },
                });

                for (const budget of activeBudgets) {
                    const spent = await Transaction.aggregate([
                        {
                            $match: {
                                userId: budget.userId,
                                type: 'expense',
                                category: budget.category,
                                date: { $gte: budget.startDate, $lte: budget.endDate },
                            },
                        },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ]);

                    const totalSpent   = spent.length > 0 ? spent[0].total : 0;
                    const percentUsed  = Math.round((totalSpent / budget.limitAmount) * 100);
                    const threshold    = budget.alertThreshold || 80;

                    if (percentUsed >= 100 && !budget.exceededSent) {
                        notifyBudgetExceeded(userId, budget.name, budget.category).catch(() => {});
                        budget.exceededSent = true;
                        budget.alertSent = true;
                        await budget.save();
                    } else if (percentUsed >= threshold && !budget.alertSent) {
                        notifyBudgetAlert(userId, budget.name, percentUsed, budget.category).catch(() => {});
                        budget.alertSent = true;
                        await budget.save();
                    }
                }
            } catch (budgetErr) {
                logger.warn('Budget notification check failed (non-fatal):', budgetErr.message);
            }
        }

        res.status(201).json({
            message: 'Transaction created successfully',
            transaction,
            newBalance: roundToTwo(account.totalBalance)
        });
    } catch (error) {
        logger.error('Error creating transaction:', error);
        next(error);
    }
};

/**
 * GET /api/transactions
 * Get all transactions with optional filters
 */
const getTransactions = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { type, category, startDate, endDate, limit = 50, page = 1 } = req.query;

        // Build query
        const query = { userId };

        if (type) query.type = type;
        if (category) query.category = category;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const transactions = await Transaction.find(query)
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Transaction.countDocuments(query);

        res.status(200).json({
            transactions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error fetching transactions:', error);
        next(error);
    }
};

/**
 * GET /api/transactions/:id
 * Get single transaction
 */
const getTransaction = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const transaction = await Transaction.findOne({ _id: id, userId });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.status(200).json(transaction);
    } catch (error) {
        logger.error('Error fetching transaction:', error);
        next(error);
    }
};

/**
 * PUT /api/transactions/:id
 * Update transaction
 */
const updateTransaction = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const transaction = await Transaction.findOne({ _id: id, userId });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // If amount or type changed, update account balance
        if (updates.amount !== undefined || updates.type !== undefined) {
            const account = await Account.findOne({ userId });

            // Reverse old transaction
            if (transaction.type === 'income') {
                account.totalBalance -= transaction.amount;
            } else {
                account.totalBalance += transaction.amount;
            }

            // Apply new transaction
            const newType = updates.type || transaction.type;
            const newAmount = updates.amount !== undefined ? updates.amount : transaction.amount;

            if (newType === 'income') {
                account.totalBalance = roundToTwo(account.totalBalance + newAmount);
            } else {
                account.totalBalance = roundToTwo(account.totalBalance - newAmount);
            }

            await account.save();
        }

        // Update transaction — allowlist safe fields only (FIX-003)
        const allowed = ['type', 'amount', 'category', 'categoryGroup', 'description', 'date', 'paymentMethod', 'tags', 'notes'];
        const safeUpdates = {};
        allowed.forEach((k) => { if (updates[k] !== undefined) safeUpdates[k] = updates[k]; });
        Object.assign(transaction, safeUpdates);
        await transaction.save();

        logger.info(`Transaction updated: ${id} for user ${userId}`);

        res.status(200).json({
            message: 'Transaction updated successfully',
            transaction
        });
    } catch (error) {
        logger.error('Error updating transaction:', error);
        next(error);
    }
};

/**
 * DELETE /api/transactions/:id
 * Delete transaction
 */
const deleteTransaction = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const transaction = await Transaction.findOne({ _id: id, userId });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update account balance
        const account = await Account.findOne({ userId });
        if (account) {
            if (transaction.type === 'income') {
                account.totalBalance = roundToTwo(account.totalBalance - transaction.amount);
            } else {
                account.totalBalance = roundToTwo(account.totalBalance + transaction.amount);
            }
            await account.save();
        }

        await Transaction.deleteOne({ _id: id });

        logger.info(`Transaction deleted: ${id} for user ${userId}`);

        res.status(200).json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        logger.error('Error deleting transaction:', error);
        next(error);
    }
};

module.exports = {
    createTransaction,
    getTransactions,
    getTransaction,
    updateTransaction,
    deleteTransaction
};

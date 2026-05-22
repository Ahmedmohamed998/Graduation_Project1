const mongoose = require('mongoose');
const Debt = require('../models/Debt');
const logger = require('../utils/logger');

/**
 * POST /api/debts
 * Create a new debt
 */
const createDebt = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { creditorName, totalAmount, interestRate, dueDate, description } = req.body;

        if (!creditorName || !totalAmount) {
            return res.status(400).json({ error: 'Creditor name and total amount are required' });
        }

        const debt = await Debt.create({
            userId,
            creditorName,
            totalAmount,
            interestRate: interestRate || 0,
            dueDate,
            description: description || ''
        });

        logger.info(`Debt created: ${creditorName} for user ${userId}`);

        res.status(201).json({
            message: 'Debt created successfully',
            debt
        });
    } catch (error) {
        logger.error('Error creating debt:', error);
        next(error);
    }
};

/**
 * GET /api/debts
 * Get all debts
 */
const getDebts = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { status } = req.query;

        const query = { userId };
        if (status) query.status = status;

        const debts = await Debt.find(query).sort({ dueDate: 1 });

        res.status(200).json({ debts });
    } catch (error) {
        logger.error('Error fetching debts:', error);
        next(error);
    }
};

/**
 * GET /api/debts/:id
 * Get single debt
 */
const getDebt = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const debt = await Debt.findOne({ _id: id, userId });

        if (!debt) {
            return res.status(404).json({ error: 'Debt not found' });
        }

        res.status(200).json(debt);
    } catch (error) {
        logger.error('Error fetching debt:', error);
        next(error);
    }
};

/**
 * PUT /api/debts/:id
 * Update debt
 */
const updateDebt = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const debt = await Debt.findOne({ _id: id, userId });

        if (!debt) {
            return res.status(404).json({ error: 'Debt not found' });
        }

        const allowed = ['creditorName', 'totalAmount', 'interestRate', 'dueDate', 'description', 'status'];
        const safeUpdates = {};
        allowed.forEach((k) => { if (req.body[k] !== undefined) safeUpdates[k] = req.body[k]; });
        Object.assign(debt, safeUpdates);
        await debt.save();

        logger.info(`Debt updated: ${id} for user ${userId}`);

        res.status(200).json({
            message: 'Debt updated successfully',
            debt
        });
    } catch (error) {
        logger.error('Error updating debt:', error);
        next(error);
    }
};

/**
 * POST /api/debts/:id/payment
 * Record a payment for debt
 */
const recordPayment = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { amount, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid payment amount is required' });
        }

        const debt = await Debt.findOne({ _id: id, userId });

        if (!debt) {
            return res.status(404).json({ error: 'Debt not found' });
        }

        debt.payments.push({
            amount,
            date: new Date(),
            notes: notes || ''
        });

        debt.paidAmount += amount;
        await debt.save();

        logger.info(`Payment of ${amount} recorded for debt ${id}, user ${userId}`);

        res.status(200).json({
            message: 'Payment recorded successfully',
            debt
        });
    } catch (error) {
        logger.error('Error recording payment:', error);
        next(error);
    }
};

/**
 * DELETE /api/debts/:id
 * Delete debt
 */
const deleteDebt = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const debt = await Debt.findOne({ _id: id, userId });

        if (!debt) {
            return res.status(404).json({ error: 'Debt not found' });
        }

        await Debt.deleteOne({ _id: id });

        logger.info(`Debt deleted: ${id} for user ${userId}`);

        res.status(200).json({ message: 'Debt deleted successfully' });
    } catch (error) {
        logger.error('Error deleting debt:', error);
        next(error);
    }
};

module.exports = {
    createDebt,
    getDebts,
    getDebt,
    updateDebt,
    recordPayment,
    deleteDebt
};

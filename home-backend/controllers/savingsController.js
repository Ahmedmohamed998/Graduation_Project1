'use strict';

const mongoose    = require('mongoose');
const SavingsGoal = require('../models/SavingsGoal');
const GoalTransaction = require('../models/GoalTransaction');
const Account     = require('../models/Account');
const logger      = require('../utils/logger');
const { roundToTwo } = require('../utils/calculations');
const { notifyGoalCompleted, notifyGoalMilestone } = require('../utils/notifications');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get or create the account for a user.
 */
async function getOrCreateAccount(userId) {
    let account = await Account.findOne({ userId });
    if (!account) {
        account = await Account.create({ userId, totalBalance: 0, allocatedSavings: 0 });
    }
    return account;
}

/**
 * Priority sort order for goals list — high first.
 */
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/savings
//  Create a new savings goal
// ─────────────────────────────────────────────────────────────────────────────
const createSavingsGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { name, targetAmount, deadline, icon, priority, description } = req.body;

        // Validation
        if (!name || !targetAmount) {
            return res.status(400).json({ error: 'Name and target amount are required' });
        }

        const parsedTarget = parseFloat(targetAmount);
        if (isNaN(parsedTarget) || parsedTarget <= 0) {
            return res.status(400).json({ error: 'Target amount must be a positive number' });
        }

        if (deadline && new Date(deadline) <= new Date()) {
            return res.status(400).json({ error: 'Deadline must be a future date' });
        }

        const savingsGoal = await SavingsGoal.create({
            userId,
            name: name.trim(),
            targetAmount: roundToTwo(parsedTarget),
            deadline: deadline || null,
            icon: icon || '🎯',
            priority: priority || 'medium',
            description: description ? description.trim() : ''
        });

        logger.info(`Savings goal created: "${name}" for user ${userId}`);

        res.status(201).json({
            message: 'Savings goal created successfully',
            savingsGoal
        });
    } catch (error) {
        logger.error('Error creating savings goal:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/savings
//  Get all savings goals — sorted high → medium → low priority
// ─────────────────────────────────────────────────────────────────────────────
const getSavingsGoals = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { status } = req.query;

        const query = { userId };

        // Filter by status (active, completed, cancelled) or legacy isCompleted param
        if (status) {
            if (!['active', 'completed', 'cancelled'].includes(status)) {
                return res.status(400).json({ error: 'status must be active, completed, or cancelled' });
            }
            query.status = status;
        } else if (req.query.isCompleted !== undefined) {
            // Backward-compatibility with old isCompleted query param
            query.status = req.query.isCompleted === 'true' ? 'completed' : 'active';
        }

        const goals = await SavingsGoal.find(query).sort({ createdAt: -1 });

        // Sort in application layer by proper priority order (high → medium → low)
        goals.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));

        // Attach summary stats
        const account = await getOrCreateAccount(userId);

        res.status(200).json({
            savingsGoals: goals,
            summary: {
                total: goals.length,
                totalSaved: roundToTwo(goals.reduce((s, g) => s + g.savedAmount, 0)),
                availableBalance: roundToTwo(account.availableBalance),
                allocatedSavings: roundToTwo(account.allocatedSavings)
            }
        });
    } catch (error) {
        logger.error('Error fetching savings goals:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/savings/:id
//  Get a single savings goal
// ─────────────────────────────────────────────────────────────────────────────
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


// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/savings/:id
//  Update savings goal metadata (name, target, deadline, icon, priority, desc)
//
//  Financial safety rule: if targetAmount is reduced below savedAmount,
//  the goal is automatically completed (no refund is triggered — the user
//  simply closes the gap by lowering the bar). If targetAmount is increased,
//  the goal is reopened if it was completed.
// ─────────────────────────────────────────────────────────────────────────────
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

        if (savingsGoal.status === 'cancelled') {
            return res.status(400).json({ error: 'Cannot edit a cancelled goal' });
        }

        const allowed = ['name', 'targetAmount', 'deadline', 'icon', 'priority', 'description'];
        allowed.forEach((k) => {
            if (req.body[k] !== undefined) savingsGoal[k] = req.body[k];
        });

        // Validate new targetAmount if provided
        if (req.body.targetAmount !== undefined) {
            const newTarget = parseFloat(req.body.targetAmount);
            if (isNaN(newTarget) || newTarget <= 0) {
                return res.status(400).json({ error: 'Target amount must be a positive number' });
            }
            savingsGoal.targetAmount = roundToTwo(newTarget);
        }

        if (req.body.deadline !== undefined && req.body.deadline !== null) {
            if (new Date(req.body.deadline) <= new Date()) {
                return res.status(400).json({ error: 'Deadline must be a future date' });
            }
        }

        // Pre-save hook handles status transitions (auto-complete / auto-reopen)
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


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/savings/:id/contribute
//  Add money to a savings goal.
//
//  Financial model:
//    1. Check availableBalance >= amount
//    2. Atomically increment goal.savedAmount
//    3. Atomically increment account.allocatedSavings
//    totalBalance is NOT changed — the money is still yours, just locked.
// ─────────────────────────────────────────────────────────────────────────────
const contributeToGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { amount, note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const parsedAmount = parseFloat(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ error: 'A valid positive amount is required' });
        }

        const roundedAmount = roundToTwo(parsedAmount);

        // Load goal
        const savingsGoal = await SavingsGoal.findOne({ _id: id, userId });
        if (!savingsGoal) {
            return res.status(404).json({ error: 'Savings goal not found' });
        }

        if (savingsGoal.status === 'cancelled') {
            return res.status(400).json({ error: 'Cannot contribute to a cancelled goal' });
        }

        if (savingsGoal.status === 'completed') {
            return res.status(400).json({ error: 'This goal is already completed. Withdraw or delete to manage funds.' });
        }

        // Load account — must exist at this point (user has balance)
        const account = await getOrCreateAccount(userId);

        // ── Available-balance check ──────────────────────────────────────────
        const available = roundToTwo(account.availableBalance);
        if (roundedAmount > available) {
            return res.status(400).json({
                error: 'Insufficient available balance',
                detail: {
                    requested: roundedAmount,
                    availableBalance: available,
                    totalBalance: roundToTwo(account.totalBalance),
                    allocatedSavings: roundToTwo(account.allocatedSavings)
                }
            });
        }

        // ── Cap at remaining (no overfunding) ────────────────────────────────
        const remaining = savingsGoal.remainingAmount;
        const effectiveAmount = Math.min(roundedAmount, remaining);

        if (effectiveAmount <= 0) {
            return res.status(400).json({ error: 'Goal is already fully funded' });
        }

        const balanceBefore = roundToTwo(savingsGoal.savedAmount);
        const balanceAfter  = roundToTwo(savingsGoal.savedAmount + effectiveAmount);

        // ── Update goal atomically ───────────────────────────────────────────
        savingsGoal.savedAmount = balanceAfter;
        await savingsGoal.save(); // pre-save hook handles status transition

        // ── Update account allocatedSavings atomically ───────────────────────
        await Account.findOneAndUpdate(
            { userId },
            { $inc: { allocatedSavings: effectiveAmount } },
            { new: true }
        );

        // ── Create audit record ──────────────────────────────────────────────
        await GoalTransaction.create({
            goalId: savingsGoal._id,
            userId,
            type: 'contribution',
            amount: effectiveAmount,
            balanceBefore,
            balanceAfter,
            note: note ? note.trim() : ''
        });

        logger.info(`Contributed ${effectiveAmount} to goal "${savingsGoal.name}" for user ${userId}`);

        // ── FCM notifications ────────────────────────────────────────────────
        const percent = Math.round((savingsGoal.savedAmount / savingsGoal.targetAmount) * 100);
        if (savingsGoal.status === 'completed') {
            notifyGoalCompleted(userId, savingsGoal.name).catch(() => {});
        } else if ([25, 50, 75].includes(percent)) {
            notifyGoalMilestone(userId, savingsGoal.name, percent).catch(() => {});
        }

        // Reload account for fresh availableBalance in response
        const updatedAccount = await Account.findOne({ userId });

        res.status(200).json({
            message: 'Contribution added successfully',
            contributed: effectiveAmount,
            savingsGoal,
            account: {
                totalBalance: roundToTwo(updatedAccount.totalBalance),
                availableBalance: roundToTwo(updatedAccount.availableBalance),
                allocatedSavings: roundToTwo(updatedAccount.allocatedSavings)
            }
        });
    } catch (error) {
        logger.error('Error contributing to savings goal:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/savings/:id/withdraw
//  Withdraw money from a savings goal (partial or full).
//
//  Financial model:
//    1. Validate withdrawal amount <= savedAmount
//    2. Decrement goal.savedAmount
//    3. Decrement account.allocatedSavings
//    totalBalance is NOT changed — money was always yours; it's now unallocated.
// ─────────────────────────────────────────────────────────────────────────────
const withdrawFromGoal = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { amount, note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const parsedAmount = parseFloat(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ error: 'A valid positive amount is required' });
        }

        const roundedAmount = roundToTwo(parsedAmount);

        const savingsGoal = await SavingsGoal.findOne({ _id: id, userId });
        if (!savingsGoal) {
            return res.status(404).json({ error: 'Savings goal not found' });
        }

        if (savingsGoal.status === 'cancelled') {
            return res.status(400).json({ error: 'Cannot withdraw from a cancelled goal' });
        }

        // Validate: cannot withdraw more than what is saved
        if (roundedAmount > savingsGoal.savedAmount) {
            return res.status(400).json({
                error: 'Withdrawal amount exceeds saved amount',
                detail: {
                    requested: roundedAmount,
                    savedAmount: roundToTwo(savingsGoal.savedAmount)
                }
            });
        }

        const balanceBefore = roundToTwo(savingsGoal.savedAmount);
        const balanceAfter  = roundToTwo(savingsGoal.savedAmount - roundedAmount);

        // ── Update goal ──────────────────────────────────────────────────────
        savingsGoal.savedAmount = balanceAfter;
        await savingsGoal.save(); // pre-save hook reopens goal if it was completed

        // ── Restore allocatedSavings ─────────────────────────────────────────
        await Account.findOneAndUpdate(
            { userId },
            { $inc: { allocatedSavings: -roundedAmount } },
            { new: true }
        );

        // ── Create audit record ──────────────────────────────────────────────
        await GoalTransaction.create({
            goalId: savingsGoal._id,
            userId,
            type: 'withdrawal',
            amount: roundedAmount,
            balanceBefore,
            balanceAfter,
            note: note ? note.trim() : ''
        });

        logger.info(`Withdrew ${roundedAmount} from goal "${savingsGoal.name}" for user ${userId}`);

        const updatedAccount = await Account.findOne({ userId });

        res.status(200).json({
            message: 'Withdrawal successful',
            withdrawn: roundedAmount,
            savingsGoal,
            account: {
                totalBalance: roundToTwo(updatedAccount.totalBalance),
                availableBalance: roundToTwo(updatedAccount.availableBalance),
                allocatedSavings: roundToTwo(updatedAccount.allocatedSavings)
            }
        });
    } catch (error) {
        logger.error('Error withdrawing from savings goal:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/savings/:id/transactions
//  Get contribution/withdrawal history for a goal
// ─────────────────────────────────────────────────────────────────────────────
const getGoalTransactions = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { limit = 50, page = 1 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        // Verify ownership
        const savingsGoal = await SavingsGoal.findOne({ _id: id, userId });
        if (!savingsGoal) {
            return res.status(404).json({ error: 'Savings goal not found' });
        }

        const skip  = (parseInt(page) - 1) * parseInt(limit);
        const [transactions, total] = await Promise.all([
            GoalTransaction.find({ goalId: id, userId })
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(skip),
            GoalTransaction.countDocuments({ goalId: id, userId })
        ]);

        const totalContributed = await GoalTransaction.aggregate([
            { $match: { goalId: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId), type: 'contribution' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const totalWithdrawn = await GoalTransaction.aggregate([
            { $match: { goalId: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId), type: 'withdrawal' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.status(200).json({
            goalId: id,
            goalName: savingsGoal.name,
            summary: {
                totalContributed: roundToTwo(totalContributed[0]?.total || 0),
                totalWithdrawn:   roundToTwo(totalWithdrawn[0]?.total   || 0),
                netSaved:         roundToTwo(savingsGoal.savedAmount)
            },
            transactions,
            pagination: {
                total,
                page:  parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        logger.error('Error fetching goal transactions:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/savings/:id
//  Delete a savings goal.
//
//  Financial rule:
//    If the goal has savedAmount > 0, those funds are returned to availableBalance
//    by decrementing account.allocatedSavings. totalBalance is NOT changed.
//    The goal is marked 'cancelled' before deletion for a brief audit window,
//    then permanently removed along with its GoalTransaction history.
// ─────────────────────────────────────────────────────────────────────────────
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

        const fundsToRestore = roundToTwo(savingsGoal.savedAmount);

        // ── Restore allocated savings back to available balance ───────────────
        if (fundsToRestore > 0) {
            await Account.findOneAndUpdate(
                { userId },
                { $inc: { allocatedSavings: -fundsToRestore } }
            );
            logger.info(`Restored ${fundsToRestore} to availableBalance on goal deletion for user ${userId}`);
        }

        // ── Delete goal and its transaction history ───────────────────────────
        await GoalTransaction.deleteMany({ goalId: id });
        await SavingsGoal.deleteOne({ _id: id });

        logger.info(`Savings goal deleted: "${savingsGoal.name}" (${id}) for user ${userId}`);

        const updatedAccount = await Account.findOne({ userId });

        res.status(200).json({
            message: 'Savings goal deleted successfully',
            fundsRestored: fundsToRestore,
            account: updatedAccount ? {
                totalBalance:     roundToTwo(updatedAccount.totalBalance),
                availableBalance: roundToTwo(updatedAccount.availableBalance),
                allocatedSavings: roundToTwo(updatedAccount.allocatedSavings)
            } : null
        });
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
    withdrawFromGoal,
    getGoalTransactions,
    deleteSavingsGoal
};

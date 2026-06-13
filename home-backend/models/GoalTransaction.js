const mongoose = require('mongoose');

/**
 * GoalTransaction — audit trail for every financial movement inside a savings goal.
 *
 * Every contribution and every withdrawal creates one record here.
 * This keeps the goal's transaction history independent of the main Transaction
 * collection, so that savings movements are never counted as income or expenses
 * in spending reports.
 */
const goalTransactionSchema = new mongoose.Schema({
    goalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SavingsGoal',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    /**
     * type:
     *   contribution — money moved from availableBalance into the goal
     *   withdrawal   — money returned from the goal to availableBalance
     */
    type: {
        type: String,
        enum: ['contribution', 'withdrawal'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Amount must be greater than 0']
    },
    /**
     * balanceBefore / balanceAfter — snapshot of goal's savedAmount before and after
     * this transaction. Enables full reconstruction of goal history.
     */
    balanceBefore: {
        type: Number,
        required: true,
        min: 0
    },
    balanceAfter: {
        type: Number,
        required: true,
        min: 0
    },
    note: {
        type: String,
        default: '',
        maxlength: 300
    }
}, {
    timestamps: true
});

// Compound index for fetching a goal's history in reverse chronological order
goalTransactionSchema.index({ goalId: 1, createdAt: -1 });
goalTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('GoalTransaction', goalTransactionSchema);

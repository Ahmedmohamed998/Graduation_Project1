const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    targetAmount: {
        type: Number,
        required: true,
        min: [0.01, 'Target amount must be greater than 0']
    },
    savedAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    deadline: {
        type: Date
    },
    icon: {
        type: String,
        default: '🎯'
    },
    priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
    },
    /**
     * status replaces the old isCompleted boolean.
     *   active    — goal is open and accepting contributions
     *   completed — savedAmount reached targetAmount; funds still locked until withdrawn
     *   cancelled — goal was abandoned; funds were returned to availableBalance on deletion
     */
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    description: {
        type: String,
        default: '',
        maxlength: 500
    },
    // Track when the goal was completed for analytics
    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// ─── Indexes ────────────────────────────────────────────────────────────────
savingsGoalSchema.index({ userId: 1, status: 1 });
savingsGoalSchema.index({ userId: 1, createdAt: -1 });

// ─── Virtuals ───────────────────────────────────────────────────────────────

/**
 * remainingAmount — how much more needs to be saved to hit the target.
 * Clamped to 0 when already funded.
 */
savingsGoalSchema.virtual('remainingAmount').get(function () {
    return Math.max(0, Math.round((this.targetAmount - this.savedAmount) * 100) / 100);
});

/**
 * progressPercentage — 0 to 100.
 * Guards against targetAmount = 0 (division by zero).
 */
savingsGoalSchema.virtual('progressPercentage').get(function () {
    if (!this.targetAmount || this.targetAmount <= 0) return 0;
    return Math.min(100, Math.round((this.savedAmount / this.targetAmount) * 10000) / 100);
});

/**
 * isCompleted — backward-compatible boolean derived from status.
 */
savingsGoalSchema.virtual('isCompleted').get(function () {
    return this.status === 'completed';
});

// ─── Pre-save hook ──────────────────────────────────────────────────────────

savingsGoalSchema.pre('save', function (next) {
    // Cap savedAmount at targetAmount — no silent overfunding
    if (this.savedAmount > this.targetAmount) {
        this.savedAmount = this.targetAmount;
    }

    // Auto-transition to completed when target is reached
    if (this.savedAmount >= this.targetAmount && this.status === 'active') {
        this.status = 'completed';
        if (!this.completedAt) this.completedAt = new Date();
    }

    // If savedAmount drops below target (withdrawal), reopen a completed goal
    if (this.savedAmount < this.targetAmount && this.status === 'completed') {
        this.status = 'active';
        this.completedAt = null;
    }

    next();
});

// ─── JSON serialization ─────────────────────────────────────────────────────
savingsGoalSchema.set('toJSON', { virtuals: true });
savingsGoalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);

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
        required: true
    },
    targetAmount: {
        type: Number,
        required: true,
        min: 0
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
    isCompleted: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Virtual for remaining amount
savingsGoalSchema.virtual('remainingAmount').get(function () {
    return this.targetAmount - this.savedAmount;
});

// Virtual for progress percentage
savingsGoalSchema.virtual('progressPercentage').get(function () {
    return (this.savedAmount / this.targetAmount) * 100;
});

// Auto-complete when target reached
savingsGoalSchema.pre('save', function (next) {
    if (this.savedAmount >= this.targetAmount) {
        this.isCompleted = true;
    }
    next();
});

// Ensure virtuals are included in JSON
savingsGoalSchema.set('toJSON', { virtuals: true });
savingsGoalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);

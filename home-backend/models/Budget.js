const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
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
    category: {
        type: String,
        required: true
    },
    limitAmount: {
        type: Number,
        required: true,
        min: 0
    },
    spentAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    period: {
        type: String,
        enum: ['weekly', 'monthly', 'yearly'],
        default: 'monthly'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    alertThreshold: {
        type: Number,
        default: 80, // Alert when 80% of budget is spent
        min: 0,
        max: 100
    },
    alertSent: {
        type: Boolean,
        default: false
    },
    exceededSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Virtual for remaining budget
budgetSchema.virtual('remainingAmount').get(function () {
    return this.limitAmount - this.spentAmount;
});

// Virtual for percentage spent
budgetSchema.virtual('percentageSpent').get(function () {
    return (this.spentAmount / this.limitAmount) * 100;
});

// Ensure virtuals are included in JSON
budgetSchema.set('toJSON', { virtuals: true });
budgetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Budget', budgetSchema);

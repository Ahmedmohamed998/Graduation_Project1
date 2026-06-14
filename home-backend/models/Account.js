const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    /**
     * totalBalance — the gross balance: all income received minus all expenses paid.
     * This is the running ledger balance and is updated on every transaction.
     */
    totalBalance: {
        type: Number,
        default: 0,
        required: true
    },
    /**
     * allocatedSavings — the total amount currently locked inside active savings goals.
     * availableBalance = totalBalance - allocatedSavings.
     * This field is incremented on contribution and decremented on withdrawal or goal deletion.
     */
    allocatedSavings: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update lastUpdated on save
accountSchema.pre('save', function (next) {
    this.lastUpdated = new Date();
    // Guard: allocatedSavings must never be negative
    if (this.allocatedSavings < 0) this.allocatedSavings = 0;
    next();
});

/**
 * Virtual: availableBalance
 * In Option 1, totalBalance is already physically reduced by savings,
 * so the available spending balance is exactly the totalBalance.
 */
accountSchema.virtual('availableBalance').get(function () {
    return Math.max(0, Math.round(this.totalBalance * 100) / 100);
});

// Include virtuals in JSON responses
accountSchema.set('toJSON', { virtuals: true });
accountSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Account', accountSchema);

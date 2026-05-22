const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    totalBalance: {
        type: Number,
        default: 0,
        required: true
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
    next();
});

module.exports = mongoose.model('Account', accountSchema);

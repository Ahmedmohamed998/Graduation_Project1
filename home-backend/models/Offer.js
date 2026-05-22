const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    discountPercentage: {
        type: Number,
        min: 0,
        max: 100
    },
    discountAmount: {
        type: Number,
        min: 0
    },
    imageUrl: {
        type: String
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        required: true
    },
    targetUsers: [{
        type: String,
        enum: ['all', 'students', 'high-spenders', 'savers', 'new-users']
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    merchantName: {
        type: String
    },
    merchantUrl: {
        type: String
    }
}, {
    timestamps: true
});

// Virtual to check if offer is still valid
offerSchema.virtual('isValid').get(function () {
    const now = new Date();
    return this.isActive && now <= this.validUntil && now >= this.validFrom;
});

// Ensure virtuals are included in JSON
offerSchema.set('toJSON', { virtuals: true });
offerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Offer', offerSchema);

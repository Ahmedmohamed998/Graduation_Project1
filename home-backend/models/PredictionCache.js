const mongoose = require('mongoose');

/**
 * PredictionCache — stores ML prediction results per user.
 * Expires automatically after validUntil (TTL index).
 */
const predictionCacheSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    predictionType: {
        type: String,
        enum: ['spending', 'budget_overrun', 'goal_completion', 'savings_rate'],
        required: true
    },
    // Hash of the input parameters so we can reuse for same inputs
    inputHash: { type: String, required: true },

    inputs:     { type: mongoose.Schema.Types.Mixed },   // raw inputs for debugging
    prediction: { type: mongoose.Schema.Types.Mixed },   // the result
    confidence: { type: Number },
    modelVersion: { type: String, default: 'v1' },

    createdAt:  { type: Date, default: Date.now },
    validUntil: { type: Date, required: true }            // TTL field — 7 days default
}, { timestamps: false });

predictionCacheSchema.index({ userId: 1, predictionType: 1, inputHash: 1 });
predictionCacheSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PredictionCache', predictionCacheSchema);

const mongoose = require('mongoose');

/**
 * AnalyticsSnapshot — cached aggregation results per user per period.
 * TTL index auto-deletes expired documents.
 */
const analyticsSnapshotSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    snapshotType: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        required: true
    },
    period: { type: String, required: true },   // e.g. "2026-04", "2026-W15"

    data: {
        summary: {
            totalIncome:   { type: Number, default: 0 },
            totalExpense:  { type: Number, default: 0 },
            netSavings:    { type: Number, default: 0 },
            savingsRate:   { type: Number, default: 0 },
            transactionCount: { type: Number, default: 0 }
        },
        topCategories: [{
            category:    String,
            amount:      Number,
            percentage:  Number,
            count:       Number
        }],
        budgetStatus: [{
            category:    String,
            spent:       Number,
            limit:       Number,
            percentage:  Number,
            status:      String   // 'ok' | 'warning' | 'exceeded'
        }],
        entryMethodBreakdown: [{
            method:     String,
            count:      Number,
            percentage: Number
        }],
        paymentMethodBreakdown: [{
            method:     String,
            amount:     Number,
            percentage: Number
        }]
    },

    createdAt:  { type: Date, default: Date.now },
    expiresAt:  { type: Date, required: true }   // TTL field
}, { timestamps: false });

// Unique per user + type + period
analyticsSnapshotSchema.index(
    { userId: 1, snapshotType: 1, period: 1 },
    { unique: true }
);
// Auto-delete expired documents
analyticsSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AnalyticsSnapshot', analyticsSnapshotSchema);

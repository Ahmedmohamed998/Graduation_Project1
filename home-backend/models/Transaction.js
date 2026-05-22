const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['income', 'expense'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Amount must be greater than 0']
    },
    category: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
        // No enum restriction — accepts any category name
        // (system categories, custom categories, or AI-suggested subcategories)
    },
    categoryGroup: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100
        // Optional: the parent group name e.g. "Housing" when category is "Utilities"
    },
    description: {
        type: String,
        default: '',
        maxlength: 500
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'mobile_wallet', 'other'],
        default: 'cash'
    },
    tags: {
        type: [String],
        validate: { validator: v => v.length <= 20, message: 'Cannot have more than 20 tags' }
    },
    attachments: [{
        type: String // URLs to uploaded files
    }],
    notes: {
        type: String,
        default: '',
        maxlength: 1000
    },

    // ── Analytics / AI entry tracking ──────────────────────────────────────
    entryMethod: {
        type: String,
        enum: ['manual', 'voice', 'ocr'],
        default: 'manual',
        index: true
    },
    voiceFeedbackId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VoiceFeedback',
        default: null
    },
    ocrFeedbackId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OcrFeedback',
        default: null
    },
    // Seconds it took user to create this transaction (for time-saved analysis)
    entryDuration: {
        type: Number,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for faster queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, entryMethod: 1, date: -1 });
transactionSchema.index({ userId: 1, paymentMethod: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);

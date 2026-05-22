const mongoose = require('mongoose');

const helpContentSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['getting_started', 'accounts', 'transactions', 'budgets', 'savings', 'debts', 'analytics', 'settings', 'security', 'faq']
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String
    }],
    videoUrl: {
        type: String,
        default: ''
    },
    relatedArticles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HelpContent'
    }]
}, {
    timestamps: true
});

// Index for efficient searching
helpContentSchema.index({ category: 1, order: 1 });
helpContentSchema.index({ tags: 1 });

module.exports = mongoose.model('HelpContent', helpContentSchema);

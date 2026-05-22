const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
    name:  { type: String, required: true, trim: true },
    icon:  { type: String, default: '📌' }
}, { _id: true });

const categorySchema = new mongoose.Schema({
    // null  → system/default category (shared by all users)
    // ObjectId → user-created custom category
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    name:  { type: String, required: true, trim: true },
    icon:  { type: String, default: '📂' },
    color: { type: String, default: '#6366f1' },   // hex color for UI

    // 'expense' | 'income' | 'both'
    type: {
        type: String,
        enum: ['expense', 'income', 'both'],
        required: true
    },

    subcategories: [subcategorySchema],

    isSystem: { type: Boolean, default: false },  // true = built-in, cannot be deleted
    isActive:  { type: Boolean, default: true }
}, {
    timestamps: true
});

// Unique name per user (null = system scope)
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);

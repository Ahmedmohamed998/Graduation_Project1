const mongoose = require('mongoose');

const voiceFeedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // What the user said
    originalTranscript: {
        type: String,
        required: true
    },

    // Language detected during transcription
    language: {
        type: String,
        enum: ['ar', 'en', 'mixed'],
        required: true
    },

    // What the AI originally extracted (before user correction)
    originalExtraction: {
        itemName:  { type: String, default: null },
        merchant:  { type: String, default: null },
        amount:    { type: Number, default: null },
        currency:  { type: String, default: null },
        quantity:  { type: Number, default: 1 },
        date:      { type: String, default: null }
    },

    // What the user corrected it to
    correctedExtraction: {
        itemName:  { type: String, default: null },
        merchant:  { type: String, default: null },
        amount:    { type: Number, default: null },
        currency:  { type: String, default: null },
        quantity:  { type: Number, default: 1 },
        date:      { type: String, default: null }
    },

    // Which fields the user actually changed
    correctedFields: [{
        type: String
    }],

    // Category that was ultimately used for the transaction
    finalCategory:      { type: String, default: null },
    finalCategoryGroup: { type: String, default: null },
    finalType:          { type: String, enum: ['income', 'expense', null], default: null },

    // Link to the transaction created after this voice entry
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },

    // Confidence scores
    transcriptionConfidence: { type: Number, default: null },
    extractionConfidence:    { type: Number, default: null },

    // Was any correction made? (quick filter for training data)
    hadCorrection: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true  // createdAt, updatedAt auto-managed
});

// Indexes for training data queries
voiceFeedbackSchema.index({ language: 1, hadCorrection: 1 });
voiceFeedbackSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('VoiceFeedback', voiceFeedbackSchema);

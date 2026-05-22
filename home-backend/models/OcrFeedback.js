const mongoose = require('mongoose');

const ocrFeedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Type of file that was uploaded
    fileType: {
        type: String,
        enum: ['image', 'pdf', 'text'],
        required: true
    },

    // Language detected in the document
    language: {
        type: String,
        enum: ['ar', 'en', 'mixed'],
        required: true
    },

    // Raw text extracted by OCR (preserved for retraining)
    originalRawText: {
        type: String,
        required: true
    },

    // What the AI originally extracted (before user correction)
    originalExtraction: {
        vendor:       { type: String, default: null },
        vendorArabic: { type: String, default: null },
        invoiceType:  { type: String, default: null },
        totalAmount:  { type: Number, default: null },
        taxAmount:    { type: Number, default: null },
        currency:     { type: String, default: null },
        date:         { type: String, default: null },
        items: [{
            name:        String,
            quantity:    Number,
            unitPrice:   Number,
            totalPrice:  Number
        }]
    },

    // What the user corrected it to
    correctedExtraction: {
        vendor:       { type: String, default: null },
        vendorArabic: { type: String, default: null },
        invoiceType:  { type: String, default: null },
        totalAmount:  { type: Number, default: null },
        taxAmount:    { type: Number, default: null },
        currency:     { type: String, default: null },
        date:         { type: String, default: null },
        items: [{
            name:        String,
            quantity:    Number,
            unitPrice:   Number,
            totalPrice:  Number
        }]
    },

    // Which fields the user actually changed
    correctedFields: [{ type: String }],

    // Category that was ultimately used for the transaction
    finalCategory:      { type: String, default: null },
    finalCategoryGroup: { type: String, default: null },
    finalType:          { type: String, enum: ['income', 'expense', null], default: null },

    // Link to the transaction created after this OCR entry
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },

    // Confidence scores
    ocrConfidence:        { type: Number, default: null },
    extractionConfidence: { type: Number, default: null },

    // Was any correction made?
    hadCorrection: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for training data queries
ocrFeedbackSchema.index({ language: 1, hadCorrection: 1 });
ocrFeedbackSchema.index({ fileType: 1, hadCorrection: 1 });
ocrFeedbackSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('OcrFeedback', ocrFeedbackSchema);

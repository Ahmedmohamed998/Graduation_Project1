const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    creditorName: {
        type: String,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    interestRate: {
        type: Number,
        default: 0,
        min: 0
    },
    dueDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['active', 'paid', 'overdue'],
        default: 'active'
    },
    payments: [{
        amount: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        notes: String
    }],
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Virtual for remaining amount
debtSchema.virtual('remainingAmount').get(function () {
    return this.totalAmount - this.paidAmount;
});

// Virtual for payment progress percentage
debtSchema.virtual('paymentProgress').get(function () {
    return (this.paidAmount / this.totalAmount) * 100;
});

// Auto-update status when fully paid
debtSchema.pre('save', function (next) {
    if (this.paidAmount >= this.totalAmount) {
        this.status = 'paid';
    } else if (this.dueDate && new Date() > this.dueDate && this.status !== 'paid') {
        this.status = 'overdue';
    }
    next();
});

// Ensure virtuals are included in JSON
debtSchema.set('toJSON', { virtuals: true });
debtSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Debt', debtSchema);

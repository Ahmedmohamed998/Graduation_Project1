const mongoose = require('mongoose');

const twoFactorAuthSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    secret: {
        type: String,
        required: true
    },
    enabled: {
        type: Boolean,
        default: false
    },
    method: {
        type: String,
        enum: ['totp', 'sms', 'email'],
        default: 'totp'
    },
    backupCodes: [{
        code: {
            type: String,
            required: true
        },
        used: {
            type: Boolean,
            default: false
        },
        usedAt: Date
    }],
    verifiedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Method to verify if a backup code is valid
twoFactorAuthSchema.methods.verifyBackupCode = function (code) {
    const backupCode = this.backupCodes.find(
        bc => bc.code === code && !bc.used
    );

    if (backupCode) {
        backupCode.used = true;
        backupCode.usedAt = new Date();
        return true;
    }

    return false;
};

// Method to generate new backup codes
twoFactorAuthSchema.methods.generateBackupCodes = function () {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        codes.push({ code, used: false });
    }
    this.backupCodes = codes;
    return codes.map(c => c.code);
};

module.exports = mongoose.model('TwoFactorAuth', twoFactorAuthSchema);

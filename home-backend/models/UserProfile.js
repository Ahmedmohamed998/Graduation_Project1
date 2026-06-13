const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        default: ''
    },
    profilePhoto: {
        type: String,
        default: ''
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED', 'JPY', 'AUD', 'CAD', 'CHF']
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    // App Preferences
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'auto'
        },
        dateFormat: {
            type: String,
            enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
            default: 'MM/DD/YYYY'
        },
        notifications: {
            budgetAlerts: {
                type: Boolean,
                default: true
            },
            goalReminders: {
                type: Boolean,
                default: true
            },
            billReminders: {
                type: Boolean,
                default: true
            },
            savingsTips: {
                type: Boolean,
                default: false
            },
            monthlyReports: {
                type: Boolean,
                default: true
            },
            dailyReminder: {
                type: Boolean,
                default: true
            },
            weeklyReport: {
                type: Boolean,
                default: true
            },
            streakAlerts: {
                type: Boolean,
                default: true
            }
        },
        biometricEnabled: {
            type: Boolean,
            default: false
        },
        language: {
            type: String,
            default: 'en',
            enum: ['en', 'ar', 'es', 'fr', 'de']
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('UserProfile', userProfileSchema);

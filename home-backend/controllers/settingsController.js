const UserProfile = require('../models/UserProfile');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const Debt = require('../models/Debt');

// Get all settings for the user
exports.getSettings = async (req, res) => {
    try {
        const userId = req.userId;

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            // Create default profile if it doesn't exist
            profile = await UserProfile.create({ userId });
        }

        res.json({
            currency: profile.currency,
            timezone: profile.timezone || 'UTC',
            preferences: profile.preferences || {
                theme: 'auto',
                dateFormat: 'MM/DD/YYYY',
                notifications: {
                    budgetAlerts: true,
                    goalReminders: true,
                    billReminders: true,
                    savingsTips: false,
                    monthlyReports: true,
                    dailyReminder: true,
                    weeklyReport: true,
                    streakAlerts: true
                },
                biometricEnabled: false,
                language: 'en'
            }
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
};

// Update timezone
exports.updateTimezone = async (req, res) => {
    try {
        const { timezone } = req.body;
        const userId = req.userId;

        if (!timezone || typeof timezone !== 'string') {
            return res.status(400).json({ error: 'Timezone string is required' });
        }

        // Validate timezone name
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch (e) {
            return res.status(400).json({ error: 'Invalid timezone name' });
        }

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            profile = await UserProfile.create({ userId });
        }

        profile.timezone = timezone;
        await profile.save();

        res.json({
            message: 'Timezone updated successfully',
            timezone: profile.timezone
        });
    } catch (error) {
        console.error('Update timezone error:', error);
        res.status(500).json({ error: 'Failed to update timezone' });
    }
};

// Update theme
exports.updateTheme = async (req, res) => {
    try {
        const { theme } = req.body;
        const userId = req.userId;

        if (!['light', 'dark', 'auto'].includes(theme)) {
            return res.status(400).json({ error: 'Invalid theme value' });
        }

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            profile = await UserProfile.create({ userId });
        }

        if (!profile.preferences) {
            profile.preferences = {};
        }

        profile.preferences.theme = theme;
        await profile.save();

        res.json({
            message: 'Theme updated successfully',
            theme: profile.preferences.theme
        });
    } catch (error) {
        console.error('Update theme error:', error);
        res.status(500).json({ error: 'Failed to update theme' });
    }
};

// Update currency
exports.updateCurrency = async (req, res) => {
    try {
        const { currency } = req.body;
        const userId = req.userId;

        const validCurrencies = ['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED', 'JPY', 'AUD', 'CAD', 'CHF'];

        if (!validCurrencies.includes(currency)) {
            return res.status(400).json({ error: 'Invalid currency' });
        }

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            profile = await UserProfile.create({ userId });
        }

        profile.currency = currency;
        await profile.save();

        res.json({
            message: 'Currency updated successfully',
            currency: profile.currency
        });
    } catch (error) {
        console.error('Update currency error:', error);
        res.status(500).json({ error: 'Failed to update currency' });
    }
};

// Update date format
exports.updateDateFormat = async (req, res) => {
    try {
        const { dateFormat } = req.body;
        const userId = req.userId;

        if (!['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(dateFormat)) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            profile = await UserProfile.create({ userId });
        }

        if (!profile.preferences) {
            profile.preferences = {};
        }

        profile.preferences.dateFormat = dateFormat;
        await profile.save();

        res.json({
            message: 'Date format updated successfully',
            dateFormat: profile.preferences.dateFormat
        });
    } catch (error) {
        console.error('Update date format error:', error);
        res.status(500).json({ error: 'Failed to update date format' });
    }
};

// Toggle biometric
exports.toggleBiometric = async (req, res) => {
    try {
        const { enabled } = req.body;
        const userId = req.userId;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'Invalid biometric value' });
        }

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            profile = await UserProfile.create({ userId });
        }

        if (!profile.preferences) {
            profile.preferences = {};
        }

        profile.preferences.biometricEnabled = enabled;
        await profile.save();

        res.json({
            message: `Biometric ${enabled ? 'enabled' : 'disabled'} successfully`,
            biometricEnabled: profile.preferences.biometricEnabled
        });
    } catch (error) {
        console.error('Toggle biometric error:', error);
        res.status(500).json({ error: 'Failed to toggle biometric' });
    }
};

// Update notification preferences
exports.updateNotifications = async (req, res) => {
    try {
        const { budgetAlerts, goalReminders, billReminders, savingsTips, monthlyReports } = req.body;
        const userId = req.userId;

        let profile = await UserProfile.findOne({ userId });

        if (!profile) {
            profile = await UserProfile.create({ userId });
        }

        if (!profile.preferences) {
            profile.preferences = {};
        }

        if (!profile.preferences.notifications) {
            profile.preferences.notifications = {};
        }

        // Update only provided values
        if (typeof budgetAlerts === 'boolean') profile.preferences.notifications.budgetAlerts = budgetAlerts;
        if (typeof goalReminders === 'boolean') profile.preferences.notifications.goalReminders = goalReminders;
        if (typeof billReminders === 'boolean') profile.preferences.notifications.billReminders = billReminders;
        if (typeof savingsTips === 'boolean') profile.preferences.notifications.savingsTips = savingsTips;
        if (typeof monthlyReports === 'boolean') profile.preferences.notifications.monthlyReports = monthlyReports;
        if (typeof dailyReminder === 'boolean') profile.preferences.notifications.dailyReminder = dailyReminder;
        if (typeof weeklyReport === 'boolean') profile.preferences.notifications.weeklyReport = weeklyReport;
        if (typeof streakAlerts === 'boolean') profile.preferences.notifications.streakAlerts = streakAlerts;

        await profile.save();

        res.json({
            message: 'Notification preferences updated successfully',
            notifications: profile.preferences.notifications
        });
    } catch (error) {
        console.error('Update notifications error:', error);
        res.status(500).json({ error: 'Failed to update notification preferences' });
    }
};

// Backup data
exports.backupData = async (req, res) => {
    try {
        const userId = req.userId;

        const [profile, accounts, transactions, budgets, goals, debts] = await Promise.all([
            UserProfile.findOne({ userId }),
            Account.find({ userId }),
            Transaction.find({ userId }),
            Budget.find({ userId }),
            SavingsGoal.find({ userId }),
            Debt.find({ userId })
        ]);

        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                profile,
                accounts,
                transactions,
                budgets,
                savingsGoals: goals,
                debts
            }
        };

        res.json({
            message: 'Data backup created successfully',
            backup
        });
    } catch (error) {
        console.error('Backup data error:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
};

// Restore data
exports.restoreData = async (req, res) => {
    try {
        const { backup } = req.body;
        const userId = req.userId;

        if (!backup || !backup.data) {
            return res.status(400).json({ error: 'Invalid backup data' });
        }

        // Verify version compatibility
        if (backup.version !== '1.0') {
            return res.status(400).json({ error: 'Incompatible backup version' });
        }

        // This is a simplified restore - in production, you'd want more careful handling
        // Clear existing data
        await Promise.all([
            Account.deleteMany({ userId }),
            Transaction.deleteMany({ userId }),
            Budget.deleteMany({ userId }),
            SavingsGoal.deleteMany({ userId }),
            Debt.deleteMany({ userId })
        ]);

        // Restore data
        const { data } = backup;

        if (data.profile) {
            await UserProfile.findOneAndUpdate(
                { userId },
                data.profile,
                { upsert: true, new: true }
            );
        }

        if (data.accounts && data.accounts.length > 0) {
            await Account.insertMany(data.accounts.map(acc => ({ ...acc, userId })));
        }

        if (data.transactions && data.transactions.length > 0) {
            await Transaction.insertMany(data.transactions.map(txn => ({ ...txn, userId })));
        }

        if (data.budgets && data.budgets.length > 0) {
            await Budget.insertMany(data.budgets.map(bud => ({ ...bud, userId })));
        }

        if (data.savingsGoals && data.savingsGoals.length > 0) {
            await SavingsGoal.insertMany(data.savingsGoals.map(goal => ({ ...goal, userId })));
        }

        if (data.debts && data.debts.length > 0) {
            await Debt.insertMany(data.debts.map(debt => ({ ...debt, userId })));
        }

        res.json({
            message: 'Data restored successfully'
        });
    } catch (error) {
        console.error('Restore data error:', error);
        res.status(500).json({ error: 'Failed to restore data' });
    }
};

// Clear all data
exports.clearAllData = async (req, res) => {
    try {
        const { confirmation } = req.body;
        const userId = req.userId;

        if (confirmation !== 'DELETE_ALL_DATA') {
            return res.status(400).json({ error: 'Invalid confirmation code' });
        }

        // Delete all user data
        await Promise.all([
            Account.deleteMany({ userId }),
            Transaction.deleteMany({ userId }),
            Budget.deleteMany({ userId }),
            SavingsGoal.deleteMany({ userId }),
            Debt.deleteMany({ userId }),
            UserProfile.deleteOne({ userId })
        ]);

        res.json({
            message: 'All data cleared successfully'
        });
    } catch (error) {
        console.error('Clear all data error:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
};

// Get app info
exports.getAppInfo = async (req, res) => {
    try {
        res.json({
            appName: 'Budget App',
            version: '1.0.0',
            build: '100',
            developer: 'Your Company Name',
            contact: 'support@budgetapp.com',
            website: 'https://budgetapp.com',
            releaseDate: '2024-01-01'
        });
    } catch (error) {
        console.error('Get app info error:', error);
        res.status(500).json({ error: 'Failed to get app info' });
    }
};

const UserProfile = require('../models/UserProfile');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { roundToTwo } = require('../utils/calculations');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard
 * Get home screen dashboard data
 */
const getDashboard = async (req, res, next) => {
    try {
        const userId = req.userId;

        logger.info(`Fetching dashboard data for user: ${userId}`);

        // Fetch user profile
        let userProfile = await UserProfile.findOne({ userId });

        // If profile doesn't exist, create a default one
        if (!userProfile) {
            userProfile = await UserProfile.create({
                userId,
                displayName: 'User',
                profilePhoto: ''
            });
            logger.info(`Created default profile for user: ${userId}`);
        }

        // Fetch or create account
        let account = await Account.findOne({ userId });
        if (!account) {
            account = await Account.create({
                userId,
                totalBalance: 0
            });
            logger.info(`Created default account for user: ${userId}`);
        }

        // Calculate current month's income and expense
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const transactions = await Transaction.find({
            userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        // Calculate totals
        const monthlyIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const monthlyExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Prepare response
        const dashboardData = {
            user: {
                name: userProfile.displayName || 'User',
                photo: userProfile.profilePhoto || '',
                currency: userProfile.currency || 'USD'
            },
            balance: {
                total: roundToTwo(account.totalBalance),
                income: roundToTwo(monthlyIncome),
                expense: roundToTwo(monthlyExpense),
                period: 'This Month'
            },
            quickActions: [
                { id: 'add_expense', label: 'Add Expense', enabled: true },
                { id: 'create_budget', label: 'Create Budget', enabled: true },
                { id: 'savings_goal', label: 'Savings Goal', enabled: true },
                { id: 'analytics', label: 'Analytics', enabled: true },
                { id: 'debt_tracking', label: 'Debt Tracking', enabled: true },
                { id: 'ai_chat', label: 'AI Chat', enabled: true },
                { id: 'offers', label: 'Offers', enabled: true }
            ]
        };

        logger.info(`Dashboard data fetched successfully for user: ${userId}`);

        res.status(200).json(dashboardData);
    } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        next(error);
    }
};

module.exports = {
    getDashboard
};

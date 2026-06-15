const UserProfile = require('../models/UserProfile');
const Account     = require('../models/Account');
const Transaction = require('../models/Transaction');
const SavingsGoal = require('../models/SavingsGoal');
const { roundToTwo } = require('../utils/calculations');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard
 * Get home screen dashboard data.
 *
 * Balance breakdown:
 *   totalBalance      — gross ledger (income minus expenses, unchanged by savings)
 *   allocatedSavings  — money currently locked inside active savings goals
 *   availableBalance  — totalBalance minus allocatedSavings (free to spend)
 *   totalSaved        — alias for allocatedSavings (frontend-friendly label)
 */
const getDashboard = async (req, res, next) => {
    try {
        const userId = req.userId;

        logger.info(`Fetching dashboard data for user: ${userId}`);

        // ── Fetch or create user profile ─────────────────────────────────────
        let userProfile = await UserProfile.findOne({ userId });
        if (!userProfile) {
            userProfile = await UserProfile.create({
                userId,
                displayName: 'User',
                profilePhoto: ''
            });
            logger.info(`Created default profile for user: ${userId}`);
        }

        // ── Fetch or create account ───────────────────────────────────────────
        let account = await Account.findOne({ userId });
        if (!account) {
            account = await Account.create({ userId, totalBalance: 0, allocatedSavings: 0 });
            logger.info(`Created default account for user: ${userId}`);
        }

        // ── Savings goals summary ─────────────────────────────────────────────
        const [activeGoals, completedGoals] = await Promise.all([
            SavingsGoal.countDocuments({ userId, status: 'active' }),
            SavingsGoal.countDocuments({ userId, status: 'completed' })
        ]);

        // ── Current month transactions ────────────────────────────────────────
        const now          = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const transactions = await Transaction.find({
            userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const monthlyIncome  = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const monthlyExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // ── Assemble response ─────────────────────────────────────────────────
        const dashboardData = {
            user: {
                name:     userProfile.displayName || 'User',
                photo:    userProfile.profilePhoto || '',
                currency: userProfile.currency || 'USD'
            },
            balance: {
                /**
                 * totalBalance — the full ledger balance (income - expenses).
                 * This does NOT decrease when contributing to goals (adds back allocated savings).
                 */
                total:            roundToTwo(account.totalBalance + account.allocatedSavings),
                /**
                 * availableBalance — money the user can freely spend right now.
                 * = totalBalance - allocatedSavings
                 */
                available:        roundToTwo(account.availableBalance),
                /**
                 * allocatedSavings — total locked inside savings goals.
                 * = sum of savedAmount across all active + completed goals.
                 */
                allocatedSavings: roundToTwo(account.allocatedSavings),
                /**
                 * totalSaved — frontend-friendly alias for allocatedSavings.
                 */
                totalSaved:       roundToTwo(account.allocatedSavings),
                income:           roundToTwo(monthlyIncome),
                expense:          roundToTwo(monthlyExpense),
                period:           'This Month'
            },
            savings: {
                activeGoals,
                completedGoals,
                totalGoals: activeGoals + completedGoals
            },
            quickActions: [
                { id: 'add_expense',    label: 'Add Expense',    enabled: true },
                { id: 'create_budget',  label: 'Create Budget',  enabled: true },
                { id: 'savings_goal',   label: 'Savings Goal',   enabled: true },
                { id: 'analytics',      label: 'Analytics',      enabled: true },
                { id: 'debt_tracking',  label: 'Debt Tracking',  enabled: true },
                { id: 'ai_chat',        label: 'AI Chat',        enabled: true },
                { id: 'offers',         label: 'Offers',         enabled: true }
            ]
        };

        logger.info(`Dashboard data fetched successfully for user: ${userId}`);

        res.status(200).json(dashboardData);
    } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        next(error);
    }
};

module.exports = { getDashboard };

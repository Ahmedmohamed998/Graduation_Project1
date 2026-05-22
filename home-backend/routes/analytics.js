const express    = require('express');
const router     = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    getOverview,
    getCategoryBreakdown,
    getTrends,
    getDailySpending,
    getBudgetAlerts,
    getEntryMethodStats,
    getSavingsOverview
} = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(verifyToken);

/**
 * GET /api/analytics/overview
 * Powers: Chart 1 (Cash Flow Card) + Budget summary
 * Query: ?period=monthly|weekly|yearly
 */
router.get('/overview', getOverview);

/**
 * GET /api/analytics/categories
 * Powers: Chart 3 (Spending Donut) + Chart 10 (Payment Method Bar)
 * Query: ?period=monthly|yearly&type=expense|income
 */
router.get('/categories', getCategoryBreakdown);

/**
 * GET /api/analytics/trends
 * Powers: Chart 2 (Income vs Expense bars) + Chart 7 (Savings Rate area)
 * Query: ?months=6
 */
router.get('/trends', getTrends);

/**
 * GET /api/analytics/daily-spending
 * Powers: Chart 8 (Calendar Heatmap)
 * Query: ?months=3
 */
router.get('/daily-spending', getDailySpending);

/**
 * GET /api/analytics/budget-alerts
 * Powers: Chart 4 (Budget Progress Bars) + Chart 9 (Alert cards)
 */
router.get('/budget-alerts', getBudgetAlerts);

/**
 * GET /api/analytics/entry-methods
 * Powers: Chart 6 (Entry Method pie — manual vs voice vs OCR)
 * Query: ?months=3
 */
router.get('/entry-methods', getEntryMethodStats);

/**
 * GET /api/analytics/savings-overview
 * Powers: Chart 5 (Savings Goals circular progress)
 */
router.get('/savings-overview', getSavingsOverview);

module.exports = router;

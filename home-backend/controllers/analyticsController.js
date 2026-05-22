/**
 * controllers/analyticsController.js
 *
 * Implements 6 analytics endpoints:
 *   GET  /api/analytics/overview          – income/expense/savings summary
 *   GET  /api/analytics/categories        – spending by category breakdown
 *   GET  /api/analytics/trends            – monthly income-expense-savings trend
 *   GET  /api/analytics/daily-spending    – per-day totals for calendar heatmap
 *   GET  /api/analytics/budget-alerts     – budget overrun predictions
 *   GET  /api/analytics/entry-methods     – manual vs voice vs OCR usage
 */

'use strict';

const mongoose       = require('mongoose');
const Transaction    = require('../models/Transaction');
const Budget         = require('../models/Budget');
const SavingsGoal    = require('../models/SavingsGoal');
const Debt           = require('../models/Debt');
const VoiceFeedback  = require('../models/VoiceFeedback');
const OcrFeedback    = require('../models/OcrFeedback');
const logger         = require('../utils/logger');
const {
    getDateRange,
    getPeriodKey,
    addMonths,
    calcSavingsRate,
    calcOverallBudgetHealth,
    budgetStatus,
    estimateGoalProbability,
    estimateBudgetOverrunProbability,
    buildIncomeExpenseChartData,
    buildCategoryDonutData,
    buildHeatmapData,
    round2
} = require('../utils/analyticsCalculations');


// ─────────────────────────────────────────────────────────────────────────────
//  Helper: ensure userId is an ObjectId for aggregations
// ─────────────────────────────────────────────────────────────────────────────
function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(id); }
    catch { return id; }
}


// ─────────────────────────────────────────────────────────────────────────────
//  1. GET /api/analytics/overview
//     Query: ?period=monthly|weekly|yearly
// ─────────────────────────────────────────────────────────────────────────────
const getOverview = async (req, res, next) => {
    try {
        const userId = toObjectId(req.userId);
        const period = req.query.period || 'monthly';
        const { startDate, endDate } = getDateRange(period);

        // ── Transactions in period ────────────────────────────────────────────
        const [incAgg, expAgg, txCount] = await Promise.all([
            Transaction.aggregate([
                { $match: { userId, type: 'income', date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.aggregate([
                { $match: { userId, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.countDocuments({ userId, date: { $gte: startDate, $lte: endDate } })
        ]);

        const totalIncome  = round2(incAgg[0]?.total || 0);
        const totalExpense = round2(expAgg[0]?.total || 0);
        const netSavings   = round2(totalIncome - totalExpense);
        const savingsRate  = calcSavingsRate(totalIncome, totalExpense);

        // ── Top 5 expense categories ──────────────────────────────────────────
        const catAgg = await Transaction.aggregate([
            { $match: { userId, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { amount: -1 } },
            { $limit: 5 }
        ]);

        const topCategories = catAgg.map(c => ({
            category:   c._id,
            amount:     round2(c.amount),
            percentage: totalExpense > 0 ? round2((c.amount / totalExpense) * 100) : 0,
            count:      c.count
        }));

        // ── Active budgets status ─────────────────────────────────────────────
        const budgets = await Budget.find({ userId, isActive: true });
        const budgetSummary = budgets.map(b => ({
            name:        b.name,
            category:    b.category,
            spent:       round2(b.spentAmount),
            limit:       round2(b.limitAmount),
            percentage:  b.limitAmount > 0 ? round2((b.spentAmount / b.limitAmount) * 100) : 0,
            remaining:   round2(Math.max(0, b.limitAmount - b.spentAmount)),
            status:      budgetStatus(b.spentAmount, b.limitAmount)
        }));

        const budgetHealthScore = calcOverallBudgetHealth(
            budgets.map(b => ({ spent: b.spentAmount, limit: b.limitAmount }))
        );

        res.status(200).json({
            period,
            dateRange:     { startDate, endDate },
            summary: {
                totalIncome,
                totalExpense,
                netSavings,
                savingsRate,
                transactionCount: txCount,
                budgetHealthScore
            },
            topCategories,
            budgetSummary,
            // Chart 1 — Cash Flow Card data (ready to render)
            cashFlowCard: {
                label:   netSavings >= 0 ? 'Net Savings' : 'Deficit',
                amount:  netSavings,
                sign:    netSavings >= 0 ? 'positive' : 'negative',
                income:  totalIncome,
                expense: totalExpense,
                savingsRate
            }
        });
    } catch (error) {
        logger.error('Error in getOverview:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  2. GET /api/analytics/categories
//     Query: ?period=monthly|yearly|weekly&type=expense|income
//     Powers: Chart 3 (Donut) + Chart 10 (Payment Method bar)
// ─────────────────────────────────────────────────────────────────────────────
const getCategoryBreakdown = async (req, res, next) => {
    try {
        const userId = toObjectId(req.userId);
        const period = req.query.period || 'monthly';
        const type   = req.query.type   || 'expense';
        const { startDate, endDate } = getDateRange(period);

        // By category
        const catData = await Transaction.aggregate([
            { $match: { userId, type, date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { amount: -1 } }
        ]);

        const totalAmount = catData.reduce((s, c) => s + c.amount, 0);
        const categories  = catData.map(c => ({
            category:   c._id,
            amount:     round2(c.amount),
            count:      c.count,
            percentage: totalAmount > 0 ? round2((c.amount / totalAmount) * 100) : 0
        }));

        // By payment method (expenses only)
        const pmData = await Transaction.aggregate([
            { $match: { userId, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: '$paymentMethod', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { amount: -1 } }
        ]);

        const totalPm     = pmData.reduce((s, p) => s + p.amount, 0);
        const byPayment   = pmData.map(p => ({
            method:     p._id || 'cash',
            amount:     round2(p.amount),
            count:      p.count,
            percentage: totalPm > 0 ? round2((p.amount / totalPm) * 100) : 0
        }));

        res.status(200).json({
            type,
            period,
            dateRange:     { startDate, endDate },
            totalAmount:   round2(totalAmount),
            // Chart 3 — Donut chart data
            donutChart:    buildCategoryDonutData(categories, 10),
            categories,
            // Chart 10 — Payment method bar chart data
            byPaymentMethod: byPayment
        });
    } catch (error) {
        logger.error('Error in getCategoryBreakdown:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  3. GET /api/analytics/trends
//     Query: ?months=6  (1-24)
//     Powers: Chart 2 (Income vs Expense bars) + Chart 7 (Savings Rate area)
// ─────────────────────────────────────────────────────────────────────────────
const getTrends = async (req, res, next) => {
    try {
        const userId     = toObjectId(req.userId);
        const monthsBack = Math.min(24, Math.max(1, parseInt(req.query.months) || 6));

        const trends = [];
        const now    = new Date();

        for (let i = monthsBack - 1; i >= 0; i--) {
            const ref   = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0);
            const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);

            const [incR, expR] = await Promise.all([
                Transaction.aggregate([
                    { $match: { userId, type: 'income', date: { $gte: start, $lte: end } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Transaction.aggregate([
                    { $match: { userId, type: 'expense', date: { $gte: start, $lte: end } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
            ]);

            const income  = round2(incR[0]?.total || 0);
            const expense = round2(expR[0]?.total || 0);
            const net     = round2(income - expense);

            trends.push({
                month:       `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`,
                monthLabel:  ref.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
                income,
                expense,
                net,
                savingsRate: calcSavingsRate(income, expense)
            });
        }

        res.status(200).json({
            months: monthsBack,
            trends,
            // Chart 2 — grouped bar + line overlay
            incomeExpenseChart: buildIncomeExpenseChartData(trends),
            // Chart 7 — Savings rate area chart
            savingsRateChart: {
                labels: trends.map(t => t.monthLabel),
                data:   trends.map(t => t.savingsRate),
                target: 20   // 20% recommended savings rate benchmark
            }
        });
    } catch (error) {
        logger.error('Error in getTrends:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  4. GET /api/analytics/daily-spending
//     Query: ?months=3
//     Powers: Chart 8 (Calendar Heatmap)
// ─────────────────────────────────────────────────────────────────────────────
const getDailySpending = async (req, res, next) => {
    try {
        const userId     = toObjectId(req.userId);
        const monthsBack = Math.min(12, Math.max(1, parseInt(req.query.months) || 3));
        const now        = new Date();
        const startDate  = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
        const endDate    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const daily = await Transaction.aggregate([
            { $match: { userId, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: {
                        y: { $year: '$date' },
                        m: { $month: '$date' },
                        d: { $dayOfMonth: '$date' }
                    },
                    amount: { $sum: '$amount' },
                    count:  { $sum: 1 }
                }
            },
            { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
        ]);

        const dailyData = daily.map(d => ({
            date:   `${d._id.y}-${String(d._id.m).padStart(2, '0')}-${String(d._id.d).padStart(2, '0')}`,
            amount: round2(d.amount),
            count:  d.count
        }));

        res.status(200).json({
            months:    monthsBack,
            dateRange: { startDate, endDate },
            // Chart 8 — Heatmap data
            heatmap:   buildHeatmapData(dailyData),
            daily:     dailyData
        });
    } catch (error) {
        logger.error('Error in getDailySpending:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  5. GET /api/analytics/budget-alerts
//     Powers: Chart 4 (Budget Progress Bars) + Chart 9 (Alerts)
// ─────────────────────────────────────────────────────────────────────────────
const getBudgetAlerts = async (req, res, next) => {
    try {
        const userId  = toObjectId(req.userId);
        const now     = new Date();
        const eom     = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysLeft = eom.getDate() - now.getDate();

        const budgets = await Budget.find({ userId, isActive: true });

        const alerts = [];
        const progressBars = [];

        for (const b of budgets) {
            const spent      = b.spentAmount   || 0;
            const limit      = b.limitAmount   || 1;
            const pct        = round2((spent / limit) * 100);
            const remaining  = round2(Math.max(0, limit - spent));
            const status     = budgetStatus(spent, limit);
            const overrunProb = estimateBudgetOverrunProbability(spent, limit, daysLeft);

            // Chart 4 — progress bar data
            progressBars.push({
                name:       b.name,
                category:   b.category,
                spent:      round2(spent),
                limit:      round2(limit),
                percentage: pct,
                remaining,
                status
            });

            // Chart 9 — only show alerts when >= warning
            if (status !== 'ok' || overrunProb >= 0.60) {
                const estOverrun = Math.max(0, round2(
                    spent + (spent / Math.max(1, now.getDate())) * daysLeft - limit
                ));

                alerts.push({
                    category:   b.category,
                    budget:     { spent: round2(spent), limit: round2(limit), percentage: pct, remaining },
                    prediction: {
                        overrunProbability:  round2(overrunProb),
                        estimatedOverrun:    estOverrun,
                        severity:            overrunProb >= 0.8 ? 'high' : overrunProb >= 0.60 ? 'medium' : 'low'
                    },
                    daysRemaining: daysLeft,
                    recommendation: remaining > 0 && daysLeft > 0
                        ? `Limit this category to ${round2(remaining / daysLeft)} EGP/day to stay on budget.`
                        : 'Budget exceeded — no new spending in this category this month.'
                });
            }
        }

        // Sort alerts by severity
        const severityOrder = { high: 0, medium: 1, low: 2 };
        alerts.sort((a, b) => severityOrder[a.prediction.severity] - severityOrder[b.prediction.severity]);

        res.status(200).json({
            daysRemainingInMonth: daysLeft,
            summary: {
                total:    budgets.length,
                exceeded: progressBars.filter(p => p.status === 'exceeded').length,
                warning:  progressBars.filter(p => p.status === 'warning').length,
                safe:     progressBars.filter(p => p.status === 'ok').length
            },
            // Chart 4 — budget progress bars
            progressBars,
            // Chart 9 — alerts
            alerts
        });
    } catch (error) {
        logger.error('Error in getBudgetAlerts:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  6. GET /api/analytics/entry-methods
//     Powers: Chart 6 (Entry Method breakdown) — shown in profile/settings
// ─────────────────────────────────────────────────────────────────────────────
const getEntryMethodStats = async (req, res, next) => {
    try {
        const userId  = toObjectId(req.userId);
        const months  = Math.min(12, Math.max(1, parseInt(req.query.months) || 3));
        const { startDate, endDate } = getDateRange('monthly');
        // Extend startDate back by (months - 1)
        const extStart = new Date(startDate.getFullYear(), startDate.getMonth() - (months - 1), 1);

        const [methodAgg, voiceStats, ocrStats] = await Promise.all([
            Transaction.aggregate([
                { $match: { userId, date: { $gte: extStart, $lte: endDate } } },
                { $group: { _id: '$entryMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
            ]),
            VoiceFeedback.aggregate([
                { $match: { userId } },
                { $group: { _id: null, total: { $sum: 1 }, corrected: { $sum: { $cond: ['$hadCorrection', 1, 0] } } } }
            ]),
            OcrFeedback.aggregate([
                { $match: { userId } },
                { $group: { _id: null, total: { $sum: 1 }, corrected: { $sum: { $cond: ['$hadCorrection', 1, 0] } } } }
            ])
        ]);

        const totalTx = methodAgg.reduce((s, m) => s + m.count, 0) || 1;

        const byMethod = methodAgg.map(m => ({
            method:      m._id || 'manual',
            count:       m.count,
            percentage:  round2((m.count / totalTx) * 100),
            totalAmount: round2(m.totalAmount)
        }));

        // Ensure all 3 methods appear even if count is 0
        const methodNames = ['manual', 'voice', 'ocr'];
        for (const mn of methodNames) {
            if (!byMethod.find(m => m.method === mn)) {
                byMethod.push({ method: mn, count: 0, percentage: 0, totalAmount: 0 });
            }
        }

        // Time saved estimation (voice: 25s saved/tx, ocr: 50s saved/tx)
        const voiceCount  = byMethod.find(m => m.method === 'voice')?.count  || 0;
        const ocrCount    = byMethod.find(m => m.method === 'ocr')?.count    || 0;
        const timeSavedSec = voiceCount * 25 + ocrCount * 50;

        // AI accuracy
        const voiceTotal    = voiceStats[0]?.total    || 0;
        const voiceCorrect  = voiceStats[0]?.corrected || 0;
        const ocrTotal      = ocrStats[0]?.total      || 0;
        const ocrCorrect    = ocrStats[0]?.corrected  || 0;

        res.status(200).json({
            period:     { months, startDate: extStart, endDate },
            totalTransactions: totalTx,
            // Chart 6 — pie/donut data
            byMethod,
            aiPerformance: {
                voice: {
                    usage:          voiceCount,
                    feedbackCount:  voiceTotal,
                    correctionRate: voiceTotal > 0 ? round2((voiceCorrect / voiceTotal) * 100) : null
                },
                ocr: {
                    usage:          ocrCount,
                    feedbackCount:  ocrTotal,
                    correctionRate: ocrTotal > 0 ? round2((ocrCorrect / ocrTotal) * 100) : null
                }
            },
            timeSaved: {
                totalSeconds: timeSavedSec,
                totalMinutes: round2(timeSavedSec / 60),
                totalHours:   round2(timeSavedSec / 3600)
            }
        });
    } catch (error) {
        logger.error('Error in getEntryMethodStats:', error);
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  7. GET /api/analytics/savings-overview
//     Powers: Chart 5 (Savings Goals) + debt summary
// ─────────────────────────────────────────────────────────────────────────────
const getSavingsOverview = async (req, res, next) => {
    try {
        const userId = toObjectId(req.userId);
        const now    = new Date();

        const [goals, debts] = await Promise.all([
            SavingsGoal.find({ userId }),
            Debt.find({ userId, status: { $ne: 'paid' } })
        ]);

        // Build goals with probability estimate
        const goalsWithStatus = goals.map(g => {
            const progress = g.targetAmount > 0
                ? round2((g.savedAmount / g.targetAmount) * 100)
                : 0;
            const probability = estimateGoalProbability(g);
            const remaining   = round2(g.targetAmount - g.savedAmount);
            let goalStatus    = 'on-track';
            if (g.isCompleted)       goalStatus = 'completed';
            else if (probability < 0.30) goalStatus = 'behind';
            else if (probability < 0.70) goalStatus = 'at-risk';

            return {
                id:           g._id,
                name:         g.name,
                icon:         g.icon,
                targetAmount: round2(g.targetAmount),
                savedAmount:  round2(g.savedAmount),
                remaining,
                progress,
                deadline:     g.deadline,
                isCompleted:  g.isCompleted,
                probability:  round2(probability),
                status:       goalStatus,
                // Chart 5 — circle progress data
                circleChart:  { value: progress, color: progress >= 50 ? '#10b981' : progress >= 20 ? '#f59e0b' : '#ef4444' }
            };
        });

        // Debt summary
        const totalDebt = debts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);
        const debtSummary = debts.map(d => ({
            id:              d._id,
            creditor:        d.creditorName,
            remaining:       round2(d.totalAmount - d.paidAmount),
            total:           round2(d.totalAmount),
            paidPct:         round2((d.paidAmount / d.totalAmount) * 100),
            interestRate:    d.interestRate,
            dueDate:         d.dueDate,
            status:          d.status
        }));

        res.status(200).json({
            goals: {
                total:      goals.length,
                completed:  goals.filter(g => g.isCompleted).length,
                active:     goals.filter(g => !g.isCompleted).length,
                items:      goalsWithStatus
            },
            debts: {
                total:       debts.length,
                totalOwed:   round2(totalDebt),
                items:       debtSummary
            }
        });
    } catch (error) {
        logger.error('Error in getSavingsOverview:', error);
        next(error);
    }
};


module.exports = {
    getOverview,
    getCategoryBreakdown,
    getTrends,
    getDailySpending,
    getBudgetAlerts,
    getEntryMethodStats,
    getSavingsOverview
};

/**
 * utils/analyticsCalculations.js
 * Pure utility functions for analytics calculations.
 * All functions are synchronous and free of side-effects.
 */

'use strict';

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
//  Date helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return { startDate, endDate } for a given period string ('monthly', 'yearly', 'weekly').
 */
function getDateRange(period = 'monthly', referenceDate = new Date()) {
    const now = new Date(referenceDate);
    let startDate, endDate;

    if (period === 'weekly') {
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
    } else if (period === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        endDate   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
        // monthly (default)
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { startDate, endDate };
}

/**
 * Return an ISO period key like "2026-04" for monthly, "2026" for yearly.
 */
function getPeriodKey(period = 'monthly', date = new Date()) {
    const d = new Date(date);
    if (period === 'yearly')  return `${d.getFullYear()}`;
    if (period === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // weekly
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - day);
    return `${mon.getFullYear()}-W${String(Math.ceil(mon.getDate() / 7)).padStart(2, '0')}`;
}

/** Add N months to a date. */
function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}

/** Add N days to a date. */
function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Financial calculations
// ─────────────────────────────────────────────────────────────────────────────

/** Savings rate as a percentage (0-100). */
function calcSavingsRate(income, expense) {
    if (!income || income <= 0) return 0;
    return round2((Math.max(0, income - expense) / income) * 100);
}

/**
 * Budget health score per budget (0-100).
 *  ≤80% utilization → 100
 *  80-100%          → 80
 *  >100%            → drops further
 */
function calcBudgetScore(spent, limit) {
    if (!limit || limit <= 0) return 100;
    const pct = (spent / limit) * 100;
    if (pct <= 80)  return 100;
    if (pct <= 100) return 80;
    return Math.max(0, 100 - (pct - 100));
}

/**
 * Average budget health score across all budgets (0-100).
 * budgets: [{ spent, limit }]
 */
function calcOverallBudgetHealth(budgets) {
    if (!budgets || budgets.length === 0) return 100;
    const total = budgets.reduce((s, b) => s + calcBudgetScore(b.spent, b.limit), 0);
    return round2(total / budgets.length);
}

/**
 * Budget status string based on utilisation %.
 */
function budgetStatus(spent, limit) {
    if (!limit || limit <= 0) return 'ok';
    const pct = (spent / limit) * 100;
    if (pct >= 100) return 'exceeded';
    if (pct >= 80)  return 'warning';
    return 'ok';
}

/**
 * Estimate the probability a savings goal will be reached by deadline.
 * Returns a value 0-1.
 */
function estimateGoalProbability(goal, monthlyContributions = []) {
    const { targetAmount = 0, savedAmount = 0, deadline } = goal;
    const remaining = targetAmount - savedAmount;

    if (remaining <= 0) return 1;   // already done
    if (!deadline)       return 0.5; // no deadline — uncertain

    const monthsLeft = Math.max(0,
        (new Date(deadline).getFullYear() - new Date().getFullYear()) * 12 +
        (new Date(deadline).getMonth() - new Date().getMonth())
    );

    if (monthsLeft <= 0) return 0;

    const avgContrib = monthlyContributions.length > 0
        ? average(monthlyContributions)
        : 0;

    if (avgContrib <= 0) return 0.1;

    const neededPerMonth = remaining / monthsLeft;
    const ratio = avgContrib / neededPerMonth;

    // Sigmoid-like mapping
    if (ratio >= 1.5) return 0.95;
    if (ratio >= 1.0) return 0.80;
    if (ratio >= 0.7) return 0.55;
    if (ratio >= 0.4) return 0.30;
    return 0.10;
}

/**
 * Estimate probability of exceeding a budget by month end.
 * Features: currentPct (0-100), daysRemaining, avgDailySpend, limit
 */
function estimateBudgetOverrunProbability(currentSpent, limit, daysRemaining) {
    if (!limit || limit <= 0) return 0;
    const pct = currentSpent / limit;

    // Simple rule-based estimate (replace with ML model later)
    const daysInMonth   = 30;
    const daysPassed    = Math.max(1, daysInMonth - daysRemaining);
    const avgDailySpend = currentSpent / daysPassed;
    const projected     = currentSpent + avgDailySpend * daysRemaining;
    const projectedPct  = projected / limit;

    if (projectedPct >= 1.3) return 0.95;
    if (projectedPct >= 1.1) return 0.80;
    if (projectedPct >= 1.0) return 0.65;
    if (projectedPct >= 0.9) return 0.40;
    return 0.10;
}

/**
 * Detect anomalously large transactions using Z-score method.
 * Returns transactions with |z| > threshold.
 */
function detectAnomalies(transactions, threshold = 2.5) {
    if (!transactions || transactions.length < 3) return [];
    const amounts = transactions.map(t => t.amount);
    const mean    = average(amounts);
    const std     = stdDev(amounts);
    if (std === 0) return [];
    return transactions.filter(t => Math.abs((t.amount - mean) / std) > threshold);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Statistics helpers
// ─────────────────────────────────────────────────────────────────────────────

function average(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
    if (!arr || arr.length < 2) return 0;
    const avg = average(arr);
    const variance = arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

function round2(v) {
    return Math.round((v || 0) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Chart data builders (called by analyticsController)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build "income vs expense" series from a monthly trends array.
 * trends: [{ month, income, expense, net }]
 */
function buildIncomeExpenseChartData(trends) {
    return {
        labels:   trends.map(t => t.month),
        income:   trends.map(t => t.income),
        expense:  trends.map(t => t.expense),
        net:      trends.map(t => t.net),
        savingsRate: trends.map(t => calcSavingsRate(t.income, t.expense))
    };
}

/**
 * Build donut chart data from category breakdown.
 * categories: [{ category, amount, percentage, count }]
 */
function buildCategoryDonutData(categories, top = 10) {
    const sorted = [...categories].sort((a, b) => b.amount - a.amount).slice(0, top);
    const total  = sorted.reduce((s, c) => s + c.amount, 0);
    return sorted.map(c => ({
        name:       c.category,
        value:      round2(c.amount),
        percentage: round2((c.amount / total) * 100),
        count:      c.count || 0
    }));
}

/**
 * Build calendar heatmap data from daily transactions.
 * dailyData: [{ date: 'YYYY-MM-DD', amount }]
 */
function buildHeatmapData(dailyData) {
    return dailyData.map(d => ({
        date:  d.date,
        value: round2(d.amount),
        level: d.amount >= 2000 ? 4 : d.amount >= 1000 ? 3 : d.amount >= 500 ? 2 : d.amount > 0 ? 1 : 0
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Caching helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a short hash from an object for use as cache key. */
function hashInputs(obj) {
    return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
}

module.exports = {
    // date
    getDateRange,
    getPeriodKey,
    addMonths,
    addDays,
    // financial
    calcSavingsRate,
    calcBudgetScore,
    calcOverallBudgetHealth,
    budgetStatus,
    estimateGoalProbability,
    estimateBudgetOverrunProbability,
    detectAnomalies,
    // stats
    average,
    stdDev,
    round2,
    // chart builders
    buildIncomeExpenseChartData,
    buildCategoryDonutData,
    buildHeatmapData,
    // cache
    hashInputs
};

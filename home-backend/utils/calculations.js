/**
 * Calculation Utilities
 * Helper functions for financial calculations
 */

/**
 * Calculate total balance from account
 * @param {Object} account - Account object
 * @returns {Number} - Total balance
 */
const getTotalBalance = (account) => {
    return account ? account.totalBalance : 0;
};

/**
 * Sum transactions by type and date range
 * @param {Array} transactions - Array of transaction objects
 * @param {String} type - 'income' or 'expense'
 * @param {Date} startDate - Start date (optional)
 * @param {Date} endDate - End date (optional)
 * @returns {Number} - Sum of transactions
 */
const sumTransactionsByType = (transactions, type, startDate = null, endDate = null) => {
    return transactions
        .filter(t => {
            const matchesType = t.type === type;
            const matchesDate = (!startDate || t.date >= startDate) &&
                (!endDate || t.date <= endDate);
            return matchesType && matchesDate;
        })
        .reduce((sum, t) => sum + t.amount, 0);
};

/**
 * Get current month start and end dates
 * @returns {Object} - { startDate, endDate }
 */
const getCurrentMonthDates = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { startDate, endDate };
};

/**
 * Calculate monthly income and expense
 * @param {Array} transactions - Array of transactions
 * @returns {Object} - { income, expense }
 */
const calculateMonthlyTotals = (transactions) => {
    const { startDate, endDate } = getCurrentMonthDates();

    const income = sumTransactionsByType(transactions, 'income', startDate, endDate);
    const expense = sumTransactionsByType(transactions, 'expense', startDate, endDate);

    return { income, expense };
};

/**
 * Round number to 2 decimal places
 * @param {Number} num - Number to round
 * @returns {Number} - Rounded number
 */
const roundToTwo = (num) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

module.exports = {
    getTotalBalance,
    sumTransactionsByType,
    getCurrentMonthDates,
    calculateMonthlyTotals,
    roundToTwo
};

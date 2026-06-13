const express = require('express');
const router  = express.Router();
const verifyToken = require('../middleware/verifyToken');

const {
    createSavingsGoal,
    getSavingsGoals,
    getSavingsGoal,
    updateSavingsGoal,
    contributeToGoal,
    withdrawFromGoal,
    getGoalTransactions,
    deleteSavingsGoal
} = require('../controllers/savingsController');

// All savings routes require authentication
router.use(verifyToken);

// ── Collection routes ────────────────────────────────────────────────────────
router.post('/',    createSavingsGoal);   // Create new goal
router.get('/',     getSavingsGoals);     // List all goals (with summary stats)

// ── Single-goal routes ───────────────────────────────────────────────────────
router.get('/:id',              getSavingsGoal);        // Get goal detail
router.put('/:id',              updateSavingsGoal);     // Edit goal metadata
router.delete('/:id',           deleteSavingsGoal);     // Delete + restore funds

// ── Financial action routes ──────────────────────────────────────────────────
router.post('/:id/contribute',  contributeToGoal);      // Add money to goal
router.post('/:id/withdraw',    withdrawFromGoal);      // Remove money from goal

// ── History route ────────────────────────────────────────────────────────────
router.get('/:id/transactions', getGoalTransactions);  // Contribution/withdrawal log

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    createTransaction,
    getTransactions,
    getTransaction,
    updateTransaction,
    deleteTransaction
} = require('../controllers/transactionController');

// All transaction routes require authentication
router.use(verifyToken);

// POST /api/transactions - Create transaction
router.post('/', createTransaction);

// GET /api/transactions - Get all transactions
router.get('/', getTransactions);

// GET /api/transactions/:id - Get single transaction
router.get('/:id', getTransaction);

// PUT /api/transactions/:id - Update transaction
router.put('/:id', updateTransaction);

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', deleteTransaction);

module.exports = router;

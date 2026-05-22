const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    createBudget,
    getBudgets,
    getBudget,
    updateBudget,
    deleteBudget
} = require('../controllers/budgetController');

router.use(verifyToken);

router.post('/', createBudget);
router.get('/', getBudgets);
router.get('/:id', getBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

module.exports = router;

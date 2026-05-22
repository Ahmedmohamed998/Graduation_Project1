const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    createSavingsGoal,
    getSavingsGoals,
    getSavingsGoal,
    updateSavingsGoal,
    contributeToGoal,
    deleteSavingsGoal
} = require('../controllers/savingsController');

router.use(verifyToken);

router.post('/', createSavingsGoal);
router.get('/', getSavingsGoals);
router.get('/:id', getSavingsGoal);
router.put('/:id', updateSavingsGoal);
router.post('/:id/contribute', contributeToGoal);
router.delete('/:id', deleteSavingsGoal);

module.exports = router;

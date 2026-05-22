const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const {
    createDebt,
    getDebts,
    getDebt,
    updateDebt,
    recordPayment,
    deleteDebt
} = require('../controllers/debtController');

router.use(verifyToken);

router.post('/', createDebt);
router.get('/', getDebts);
router.get('/:id', getDebt);
router.put('/:id', updateDebt);
router.post('/:id/payment', recordPayment);
router.delete('/:id', deleteDebt);

module.exports = router;

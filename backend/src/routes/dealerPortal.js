const router = require('express').Router();
const c = require('../controllers/dealerPortalController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('dealer'));
router.get('/profile',  c.getProfile);
router.get('/orders',   c.getOrders);
router.get('/payments', c.getPayments);
router.get('/summary',  c.getSummary);
router.get('/stock',    c.getStockStatus);

module.exports = router;

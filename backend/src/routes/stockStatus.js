const router = require('express').Router();
const c = require('../controllers/stockStatusController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Summary + product list
router.get('/', c.getStockStatus);

// Dealer+product ledger
router.get('/dealer/:dealerId/product/:productId/ledger', c.getStockLedger);

// Record dealer sale (with stock validation)
router.post('/dealer-sales', authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), c.recordDealerSales);

// Stock adjustments (damage, expired, sample, etc.)
router.post('/adjustments', authorize('admin', 'nsm', 'rsm', 'asm', 'se'), c.createAdjustment);

// Record a single transaction
router.post('/transaction', authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'so'), c.createTransaction);

// Atomic stock transfer between two dealers
router.post('/transfer',  authorize('admin', 'nsm', 'rsm', 'asm', 'se'), c.createTransfer);
router.post('/transfers', authorize('admin', 'nsm', 'rsm', 'asm', 'se'), c.createTransfer);

module.exports = router;

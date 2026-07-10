const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.get('/sales', c.salesReport);
router.get('/collections', c.collectionReport);
router.get('/lifting', c.liftingReport);
router.get('/dealer-outstanding', c.dealerOutstanding);
router.get('/salesperson-performance', c.salespersonPerformance);
router.get('/product-wise', c.productWiseSales);
router.get('/province-wise', c.provinceWiseSales);
router.get('/monthly-sales', c.monthlySalesReport);

module.exports = router;

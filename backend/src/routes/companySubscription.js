const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/platformAdminController');

router.get('/subscription', protect, c.getCompanySubscription);
router.get('/subscription/status', protect, c.getCompanySubscriptionStatus);

module.exports = router;

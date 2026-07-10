const router = require('express').Router();
const { getDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getDashboard);

module.exports = router;

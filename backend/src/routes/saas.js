const router = require('express').Router();
const c = require('../controllers/saasController');
const { protect } = require('../middleware/auth');

const superAdminOnly = (req, res, next) => {
  if (!req.user?.isSuperAdmin)
    return res.status(403).json({ success: false, message: 'Super Admin access required' });
  next();
};

// Super Admin only
router.get('/companies',                          protect, superAdminOnly, c.listCompanies);
router.post('/companies',                         protect, superAdminOnly, c.addCompany);
router.post('/companies/onboard-legacy',          protect, superAdminOnly, c.onboardLegacy);
router.patch('/companies/:id/status',             protect, superAdminOnly, c.updateCompanyStatus);

module.exports = router;

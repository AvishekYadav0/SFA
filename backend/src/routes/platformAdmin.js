const express = require('express');
const router = express.Router();
const c = require('../controllers/platformAdminController');
const { platformProtect, requirePlatformPermission } = require('../middleware/platformAuth');
const { protect } = require('../middleware/auth');

router.post('/auth/login', c.login);
router.get('/auth/me', platformProtect, c.getMe);

router.use(platformProtect);
router.get('/dashboard', requirePlatformPermission('dashboard'), c.getDashboard);
router.get('/companies', requirePlatformPermission('companies'), c.getCompanies);
router.get('/companies/:id', requirePlatformPermission('companies'), c.getCompanyDetail);
router.post('/companies/:id/activate', requirePlatformPermission('companies'), c.activateCompany);
router.post('/companies/:id/suspend', requirePlatformPermission('companies'), c.suspendCompany);
router.post('/companies/:id/extend-license', requirePlatformPermission('companies'), c.extendLicense);
router.post('/companies/:id/change-plan', requirePlatformPermission('companies'), c.changePlan);
router.post('/companies/:id/user-limits', requirePlatformPermission('companies'), c.updateUserLimits);
router.post('/companies/:id/features', requirePlatformPermission('companies'), c.updateFeatures);

router.get('/plans', requirePlatformPermission('plans'), c.getPlans);
router.post('/plans', requirePlatformPermission('plans'), c.createPlan);
router.patch('/plans/:id', requirePlatformPermission('plans'), c.updatePlan);
router.get('/feature-catalog', requirePlatformPermission('features'), c.getFeatureCatalog);
router.get('/subscriptions', requirePlatformPermission('subscriptions'), c.getSubscriptions);
router.patch('/subscriptions/:id/status', requirePlatformPermission('subscriptions'), c.updateSubscriptionStatus);
router.get('/users', requirePlatformPermission('users'), c.getPlatformUsers);
router.get('/payments', requirePlatformPermission('payments'), c.getPayments);
router.post('/payments/manual', requirePlatformPermission('payments'), c.recordManualPayment);
router.post('/payments/:id/verify', requirePlatformPermission('payments'), c.verifyManualPayment);
router.get('/audit-logs', requirePlatformPermission('audit_logs'), c.getAuditLogs);

module.exports = router;

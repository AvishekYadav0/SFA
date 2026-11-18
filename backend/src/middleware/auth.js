const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const { withTenantContext } = require('../utils/tenantContext');
const { tenantContextFor } = require('../utils/tenantModels');
const { normalizeFeatureKeys } = require('../services/platformFeatureCatalog');

const FEATURE_BY_API_PREFIX = new Map([
  ['/api/dashboard', 'dashboard'],
  ['/api/dealers', 'dealers'],
  ['/api/dealer-portal', 'dealer_portal'],
  ['/api/users', 'team_management'],
  ['/api/salespersons', 'team_management'],
  ['/api/products', 'products'],
  ['/api/orders', 'orders'],
  ['/api/pipeline', 'pipeline'],
  ['/api/sales', 'sales'],
  ['/api/collections', 'collections'],
  ['/api/collection-plans', 'collection_plans'],
  ['/api/monthly-planning', 'monthly_planning'],
  ['/api/stock-status', 'stock_status'],
  ['/api/daily-visits', 'daily_visits'],
  ['/api/visits', 'visits'],
  ['/api/targets', 'targets'],
  ['/api/reports', 'reports'],
  ['/api/lifting', 'lifting'],
  ['/api/claims', 'claims'],
  ['/api/notifications', 'notifications'],
  ['/api/profile', 'profile'],
  ['/api/settings', 'settings'],
  ['/api/admin/backups', 'database_backup'],
]);

function featureForRequest(req) {
  const baseUrl = req.baseUrl || '';
  for (const [prefix, feature] of FEATURE_BY_API_PREFIX) {
    if (baseUrl === prefix || baseUrl.startsWith(`${prefix}/`)) return feature;
  }
  return null;
}

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.companyId || !decoded.tenantId) {
      return res.status(401).json({ success: false, message: 'Company verification is required. Please verify your company and sign in again.' });
    }
    const company = await Company.findById(decoded.companyId);
    if (!company || company.status !== 'active' || company.tenantId !== decoded.tenantId) {
      return res.status(403).json({ success: false, message: 'This company is inactive or its session is no longer valid.' });
    }
    const context = tenantContextFor(company);
    return await withTenantContext(context, async () => {
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
      const userCompanyMatches = String(req.user.companyId || '') === String(company._id)
        || (company.isLegacy && !req.user.companyId);
      if (!userCompanyMatches || (req.user.tenantId && req.user.tenantId !== company.tenantId)) {
        return res.status(403).json({ success: false, message: 'This account does not belong to the verified company.' });
      }
      req.company = company;
      req.user.companyName = company.name;
      const Subscription = require('../models/Subscription');
      const subscription = await Subscription.findOne({ companyId: company._id }).lean();
      if (subscription) {
        if (subscription.status === 'suspended') {
          return res.status(403).json({ success: false, code: 'SUBSCRIPTION_SUSPENDED', message: 'This company subscription is suspended.' });
        }
        if (!['active', 'past_due'].includes(subscription.status)) {
          return res.status(403).json({ success: false, code: 'SUBSCRIPTION_INACTIVE', message: 'This company subscription is not active. Contact the platform administrator.' });
        }
        if (subscription.expiryDate) {
          const expiry = new Date(subscription.expiryDate);
          const graceEnd = new Date(expiry.getTime() + (Number(subscription.gracePeriodDays || 0) * 24 * 60 * 60 * 1000));
          if (new Date() > graceEnd) {
            return res.status(403).json({ success: false, code: 'SUBSCRIPTION_EXPIRED', message: 'Your company subscription has expired. Please renew it to continue.' });
          }
        }
      }
      const feature = featureForRequest(req);
      if (feature) {
        if (subscription && !normalizeFeatureKeys(subscription.assignedFeatures || []).includes(feature)) {
          return res.status(403).json({
            success: false,
            code: 'FEATURE_DISABLED',
            message: `The ${feature} module is not enabled for this company.`,
          });
        }
      }
      return next();
    });
  } catch (error) {
    console.error('Company authentication failed:', error.message);
    const tokenError = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name);
    res.status(tokenError ? 401 : 503).json({
      success: false,
      message: tokenError ? 'Token invalid' : 'Company data is temporarily unavailable.',
    });
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
};

/**
 * scopeFilter — MongoDB filter for Order / Collection / Visit / Dealer documents.
 *
 * Hierarchy stored on every document:
 *   nsm | rsm | asm | se | so (array on Dealer, ObjectId on Order/Collection/Visit)
 *
 * For Dealer, `so` is an array field → use $elemMatch / $in.
 * Pass `model = 'dealer'` when querying the Dealer collection.
 */
exports.scopeFilter = (req, model = 'default') => {
  const { role, _id } = req.user;

  if (role === 'admin') return {};
  if (role === 'nsm') return { nsm: _id };
  if (role === 'rsm') return { rsm: _id };
  if (role === 'asm') return { asm: _id };
  if (role === 'se')  return { se:  _id };

  if (role === 'so') {
    if (model === 'dealer') return { so: _id };
    return { so: _id };
  }

  // Dealer role: scope to their linked dealer document
  if (role === 'dealer') {
    const dealerId = req.user.linkedDealer;
    if (!dealerId) return { _id: null };
    if (model === 'dealer') return { _id: dealerId };
    return { dealer: dealerId };
  }

  return { _id: null }; // deny-all fallback
};

/**
 * userScopeFilter — MongoDB filter for the User collection.
 *
 * User model hierarchy fields: reportsTo, nsm, rsm, asm
 * SE's subordinates (SO) have reportsTo = se._id
 * SO has no subordinates in the user tree
 */
exports.userScopeFilter = (req) => {
  const { role, _id } = req.user;

  if (role === 'admin') return { role: { $ne: 'admin' } };
  if (role === 'nsm')   return { role: { $ne: 'admin' }, $or: [{ nsm: _id }, { _id }] };
  // rsm/asm: match stamped hierarchy field OR direct reportsTo
  // (stamped rsm/asm covers full chain for properly-created users;
  //  reportsTo covers direct reports; both together handle all cases)
  if (role === 'rsm')   return { role: { $ne: 'admin' }, $or: [{ rsm: _id }, { reportsTo: _id }] };
  if (role === 'asm')   return { role: { $ne: 'admin' }, $or: [{ asm: _id }, { reportsTo: _id }] };
  if (role === 'se')    return { reportsTo: _id };
  if (role === 'so')    return { _id };
  if (role === 'dealer') return { _id: null };

  return { _id: null };
};

/**
 * hierarchyFields — given the creating user, return the full hierarchy
 * object to stamp onto a new Order / Collection / Visit document.
 *
 * Works for both SE and SO creators.
 */
exports.hierarchyFields = async (creatingUser) => {
  const User = require('../models/User');
  const { role, _id, asm, rsm, nsm, reportsTo } = creatingUser;

  if (role === 'se') {
    return { se: _id, asm, rsm, nsm };
  }

  if (role === 'so') {
    // SO reports to an SE; load that SE to get the full chain
    const se = reportsTo ? await User.findById(reportsTo).lean() : null;
    return {
      so:  _id,
      se:  se?._id  || null,
      asm: se?.asm   || null,
      rsm: se?.rsm   || null,
      nsm: se?.nsm   || null,
    };
  }

  // Admin / NSM / RSM / ASM creating on behalf of someone — caller must supply se
  return {};
};

exports.requireCompanySubscription = async (req, res, next) => {
  const Subscription = require('../models/Subscription');
  if (!req.company?._id) {
    return res.status(401).json({ success: false, message: 'Company context is required.' });
  }

  const subscription = await Subscription.findOne({ companyId: req.company._id }).lean();
  if (!subscription) {
    return res.status(403).json({ success: false, message: 'No subscription is active for this company.' });
  }

  const now = new Date();
  const expiresAt = subscription.expiryDate ? new Date(subscription.expiryDate) : null;
  if (expiresAt && now > expiresAt && subscription.status !== 'active') {
    return res.status(403).json({ success: false, message: 'Your company subscription has expired. Please renew it to continue.' });
  }

  if (subscription.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'Your company subscription is suspended.' });
  }

  req.subscription = subscription;
  next();
};

exports.requireFeatureAccess = (feature) => async (req, res, next) => {
  const Subscription = require('../models/Subscription');
  const subscription = await Subscription.findOne({ companyId: req.company._id }).lean();
  if (!subscription) {
    return res.status(403).json({ success: false, code: 'SUBSCRIPTION_REQUIRED', message: 'The company subscription is missing or inactive.' });
  }

  const features = Array.isArray(subscription.assignedFeatures) ? subscription.assignedFeatures : [];
  if (!features.includes(feature)) {
    return res.status(403).json({ success: false, code: 'FEATURE_DISABLED', message: `Feature '${feature}' is not enabled for this company.` });
  }
  next();
};

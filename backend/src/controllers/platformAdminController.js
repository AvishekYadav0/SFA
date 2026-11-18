const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const PlatformAdmin = require('../models/PlatformAdmin');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const AuditLog = require('../models/AuditLog');
const { withTenantContext } = require('../utils/tenantContext');
const { tenantContextFor } = require('../utils/tenantModels');
const { ensureDefaultPlans, ensureCompanySubscription, daysRemaining, createAuditEntry } = require('../services/subscriptionService');
const { PLATFORM_FEATURES, normalizeFeatureKeys } = require('../services/platformFeatureCatalog');

function workingCompanyContext(company) {
  return withTenantContext(tenantContextFor(company), async () => {
    const [activeUsers, inactiveUsers, totalUsers] = await Promise.all([
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'inactive' }),
      User.countDocuments({}),
    ]);
    return { activeUsers, inactiveUsers, totalUsers };
  });
}

async function getCompanyMetrics(company) {
  const subscription = await Subscription.findOne({ companyId: company._id }).lean();
  const tenantMetrics = await workingCompanyContext(company);
  const remaining = subscription?.expiryDate ? daysRemaining(subscription.expiryDate) : 0;
  return {
    _id: company._id,
    name: company.name,
    email: company.email,
    tenantId: company.tenantId,
    status: company.status,
    plan: subscription?.planName || company.plan || 'Basic',
    planCode: subscription?.planCode || 'BASIC',
    subscriptionStatus: subscription?.status || 'pending',
    startDate: subscription?.startDate || null,
    expiryDate: subscription?.expiryDate || null,
    daysRemaining: remaining,
    maxUsers: subscription?.maxUsers || company.adminCount || 10,
    currentUsers: tenantMetrics.activeUsers,
    maxDealers: subscription?.maxDealers || 25,
    assignedFeatures: normalizeFeatureKeys(subscription?.assignedFeatures || []),
    createdAt: company.createdAt,
  };
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const admin = await PlatformAdmin.findOne({ email: String(email).trim().toLowerCase() }).select('+passwordHash');
    if (!admin || !admin.isActive) return res.status(401).json({ success: false, message: 'Invalid platform admin credentials.' });
    const passwordValid = await admin.matchPassword(password);
    if (!passwordValid) return res.status(401).json({ success: false, message: 'Invalid platform admin credentials.' });

    const token = jwt.sign({ id: admin._id, accountType: 'platform_admin', email: admin.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
    admin.lastLogin = new Date();
    await admin.save();

    res.json({ success: true, token, user: { id: admin._id, name: admin.name, email: admin.email, accountType: admin.accountType, permissions: admin.permissions } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Platform login failed.' });
  }
};

exports.getMe = async (req, res) => {
  const admin = req.platformAdmin;
  res.json({ success: true, user: { id: admin._id, name: admin.name, email: admin.email, accountType: admin.accountType, permissions: admin.permissions } });
};

exports.getDashboard = async (req, res) => {
  try {
    await ensureDefaultPlans();
    const companies = await Company.find().lean();
    const totalUsers = await Promise.all(companies.map(async (company) => {
      const result = await withTenantContext(tenantContextFor(company), async () => User.countDocuments({}));
      return result;
    }));
    const activeUsers = await Promise.all(companies.map(async (company) => {
      const result = await withTenantContext(tenantContextFor(company), async () => User.countDocuments({ status: 'active' }));
      return result;
    }));

    const [companyCount, activeCompanies, suspendedCompanies, pendingCompanies, subscriptionRows, expiredSubscriptions, expiringSoon, pendingPayments, revenue, inactiveCompanies] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ status: 'active' }),
      Company.countDocuments({ status: 'suspended' }),
      Company.countDocuments({ status: 'pending' }),
      Subscription.find().select('companyId planCode').lean(),
      Subscription.countDocuments({ status: 'expired' }),
      Subscription.countDocuments({ status: 'active', expiryDate: { $gte: new Date(), $lte: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) } }),
      SubscriptionPayment.countDocuments({ paymentStatus: 'pending' }),
      SubscriptionPayment.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Company.countDocuments({ status: { $ne: 'active' } }),
    ]);
    const plansByCompany = new Map(subscriptionRows.map((subscription) => [String(subscription.companyId), subscription.planCode]));
    const effectivePlan = (company) => plansByCompany.get(String(company._id)) || String(company.plan || '').toUpperCase();
    const basicPlans = companies.filter((company) => effectivePlan(company) === 'BASIC').length;
    const proPlans = companies.filter((company) => effectivePlan(company) === 'PRO').length;

    const recentCompanies = await Promise.all(companies.slice(0, 10).map(async (company) => {
      const rawSubscription = await Subscription.findOne({ companyId: company._id }).lean();
      const subscription = rawSubscription
        ? { ...rawSubscription, assignedFeatures: normalizeFeatureKeys(rawSubscription.assignedFeatures || []) }
        : null;
      return { ...company, subscription: subscription || null };
    }));

    const dashboard = {
      stats: {
        totalCompanies: companyCount,
        activeCompanies,
        inactiveCompanies,
        suspendedCompanies,
        basicPlanCompanies: basicPlans,
        proPlanCompanies: proPlans,
        expiredSubscriptions,
        subscriptionsExpiringSoon: expiringSoon,
        totalRegisteredUsers: totalUsers.reduce((sum, count) => sum + count, 0),
        activeUsers: activeUsers.reduce((sum, count) => sum + count, 0),
        totalRevenue: revenue[0]?.total || 0,
        pendingPayments,
      },
      recentCompanies,
      planDistribution: {
        basic: basicPlans,
        pro: proPlans,
      },
    };

    res.json({ success: true, data: dashboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load platform dashboard.' });
  }
};

exports.getCompanies = async (req, res) => {
  try {
    await ensureDefaultPlans();
    const companies = await Company.find().sort({ createdAt: -1 }).lean();
    const rows = await Promise.all(companies.map(async (company) => {
      const subscription = await Subscription.findOne({ companyId: company._id }).lean();
      const tenantMetrics = await withTenantContext(tenantContextFor(company), async () => {
        const activeUsers = await User.countDocuments({ status: 'active' });
        return { activeUsers };
      });
      const daysLeft = subscription?.expiryDate ? daysRemaining(subscription.expiryDate) : 0;
      return {
        _id: company._id,
        name: company.name,
        email: company.email,
        tenantId: company.tenantId,
        registeredAt: company.createdAt,
        subscriptionPlan: subscription?.planName || (company.plan === 'basic' ? 'Basic' : company.plan === 'pro' ? 'Pro' : 'Unassigned'),
        subscriptionStatus: subscription?.status || 'pending',
        licenseStart: subscription?.startDate || null,
        licenseExpiry: subscription?.expiryDate || null,
        daysRemaining: daysLeft,
        registeredUsers: tenantMetrics.activeUsers,
        maxUsers: subscription?.maxUsers || 10,
        maxDealers: subscription?.maxDealers || 20,
        planCode: subscription?.planCode || (company.plan === 'basic' ? 'BASIC' : company.plan === 'pro' ? 'PRO' : null),
        assignedFeatures: normalizeFeatureKeys(subscription?.assignedFeatures || []),
        companyStatus: company.status,
        isLegacy: !!company.isLegacy,
      };
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load companies.' });
  }
};

exports.getCompanyDetail = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const rawSubscription = await Subscription.findOne({ companyId: company._id }).lean();
    const subscription = rawSubscription
      ? { ...rawSubscription, assignedFeatures: normalizeFeatureKeys(rawSubscription.assignedFeatures || []) }
      : null;
    const tenantUsers = await withTenantContext(tenantContextFor(company), async () => User.find({ status: { $ne: 'deleted' } }).select('_id name email role status lastLogin').lean());
    const payments = await SubscriptionPayment.find({ companyId: company._id }).sort({ createdAt: -1 }).lean();
    const auditLogs = await AuditLog.find({ companyId: company._id }).sort({ createdAt: -1 }).limit(20).lean();

    const detail = {
      company: {
        _id: company._id,
        name: company.name,
        email: company.email,
        tenantId: company.tenantId,
        status: company.status,
        plan: company.plan,
        createdAt: company.createdAt,
      },
      subscription,
      users: tenantUsers,
      payments,
      auditLogs,
    };

    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load company detail.' });
  }
};

exports.activateCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    const subscription = await Subscription.findOne({ companyId: company._id });
    if (!subscription || subscription.paymentStatus !== 'paid'
      || !subscription.expiryDate || new Date(subscription.expiryDate) <= new Date()) {
      return res.status(409).json({ success: false, message: 'A verified, unexpired paid subscription is required before activating this company.' });
    }

    const previousStatus = company.status;
    company.status = 'active';
    await company.save();
    const previousSubscriptionStatus = subscription.status;
    subscription.status = 'active';
    subscription.activatedBy = req.platformAdmin.email;
    await subscription.save();
    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: 'company_activated',
      module: 'company',
      description: 'Company activated by platform admin',
      previousValue: { companyStatus: previousStatus, subscriptionStatus: previousSubscriptionStatus },
      newValue: { companyStatus: 'active', subscriptionStatus: 'active' },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { company, subscription } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to activate company.' });
  }
};

exports.suspendCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    const previousStatus = company.status;
    company.status = 'suspended';
    await company.save();

    const subscription = await Subscription.findOne({ companyId: company._id });
    if (subscription) {
      subscription.status = 'suspended';
      await subscription.save();
    }

    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: 'company_suspended',
      module: 'company',
      description: 'Company suspended by platform admin',
      previousValue: { status: previousStatus },
      newValue: { status: 'suspended' },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { company, subscription } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to suspend company.' });
  }
};

exports.extendLicense = async (req, res) => {
  try {
    const { durationDays = 365 } = req.body || {};
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const subscription = await Subscription.findOne({ companyId: company._id });
    if (!subscription) return res.status(404).json({ success: false, message: 'No active subscription found.' });

    const previousExpiry = subscription.expiryDate;
    const extensionStart = previousExpiry && new Date(previousExpiry) > new Date() ? new Date(previousExpiry) : new Date();
    const nextExpiry = new Date(extensionStart.getTime() + (Number(durationDays) * 24 * 60 * 60 * 1000));
    subscription.durationDays = Number(durationDays);
    subscription.expiryDate = nextExpiry;
    subscription.status = 'active';
    await subscription.save();

    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: subscription.companyId,
      action: 'license_extended',
      module: 'subscription',
      description: 'Subscription license extended by platform admin',
      previousValue: { expiryDate: previousExpiry },
      newValue: { durationDays: Number(durationDays), expiryDate: nextExpiry },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to extend license.' });
  }
};

exports.changePlan = async (req, res) => {
  try {
    const { planCode = 'BASIC', durationDays, maxUsers, maxDealers, features } = req.body || {};
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const plan = await SubscriptionPlan.findOne({ code: String(planCode).toUpperCase() });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });

    const previous = await Subscription.findOne({ companyId: company._id }).lean();
    const previousCompanyPlan = company.plan;
    const options = {
      planCode: plan.code,
      maxUsers: maxUsers ?? plan.maxUsers,
      maxDealers: maxDealers ?? plan.maxDealers,
      features: features ?? plan.features,
      status: previous ? previous.status : 'pending',
      paymentStatus: previous ? previous.paymentStatus : 'pending',
      activatedBy: req.platformAdmin.email,
    };
    if (durationDays !== undefined) options.durationDays = durationDays;
    const subscription = await ensureCompanySubscription(company, options);
    company.plan = plan.code.toLowerCase();
    await company.save();

    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: 'plan_changed',
      module: 'subscription',
      description: `Company plan changed to ${plan.name}`,
      previousValue: { planCode: previous?.planCode || previousCompanyPlan || null, expiryDate: previous?.expiryDate || null },
      newValue: {
        planCode: plan.code,
        expiryDate: subscription.expiryDate,
        maxUsers: subscription.maxUsers,
        maxDealers: subscription.maxDealers,
        features: subscription.assignedFeatures,
      },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update plan.' });
  }
};

exports.updateUserLimits = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const { maxUsers = 10, maxDealers = 25 } = req.body || {};
    const existingSubscription = await Subscription.findOne({ companyId: company._id }).lean();
    const previousValue = { maxUsers: existingSubscription?.maxUsers ?? null, maxDealers: existingSubscription?.maxDealers ?? null };
    const planCode = existingSubscription?.planCode || (company.plan === 'pro' ? 'PRO' : 'BASIC');
    const subscription = await ensureCompanySubscription(company, { planCode, maxUsers, maxDealers, activatedBy: req.platformAdmin.email });
    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: 'user_limit_updated',
      module: 'subscription',
      description: 'User and dealer limits updated by platform admin',
      previousValue,
      newValue: { maxUsers, maxDealers },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update user limits.' });
  }
};

exports.updateFeatures = async (req, res) => {
  try {
    const { features } = req.body || {};
    if (!Array.isArray(features) || features.some(feature => !PLATFORM_FEATURES.some(item => item.key === feature))) {
      return res.status(400).json({ success: false, message: 'A valid feature list is required.' });
    }
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    let subscription = await Subscription.findOne({ companyId: company._id });
    if (!subscription) {
      const companyPlan = String(company.plan || 'basic').toUpperCase();
      subscription = await ensureCompanySubscription(company, {
        planCode: companyPlan === 'PRO' ? 'PRO' : 'BASIC',
        activatedBy: req.platformAdmin.email,
      });
    }
    const previousFeatures = subscription.assignedFeatures || [];
    subscription.assignedFeatures = features;
    await subscription.save();
    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: 'features_updated',
      module: 'feature',
      description: 'Subscription features updated by platform admin',
      previousValue: { features: previousFeatures },
      newValue: { features },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update features.' });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const plans = await ensureDefaultPlans();
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load plans.' });
  }
};

exports.createPlan = async (req, res) => {
  res.status(405).json({ success: false, message: 'Only the Basic and Pro subscription plans are supported.' });
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    const { description, price, currency, defaultDurationDays, maxUsers, maxDealers, features, isActive } = req.body || {};
    if (features !== undefined && (!Array.isArray(features) || features.some(feature => !PLATFORM_FEATURES.some(item => item.key === feature)))) {
      return res.status(400).json({ success: false, message: 'Plan features must use the platform feature catalog.' });
    }
    if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ success: false, message: 'Plan price must be zero or greater.' });
    }
    if (defaultDurationDays !== undefined && (!Number.isInteger(Number(defaultDurationDays)) || Number(defaultDurationDays) < 1)) {
      return res.status(400).json({ success: false, message: 'Plan duration must be at least one day.' });
    }
    if (maxUsers !== undefined && (!Number.isInteger(Number(maxUsers)) || Number(maxUsers) < 1)) {
      return res.status(400).json({ success: false, message: 'Maximum users must be at least one.' });
    }
    if (maxDealers !== undefined && (!Number.isInteger(Number(maxDealers)) || Number(maxDealers) < 0)) {
      return res.status(400).json({ success: false, message: 'Maximum dealers cannot be negative.' });
    }

    const previousValue = {
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      defaultDurationDays: plan.defaultDurationDays,
      maxUsers: plan.maxUsers,
      maxDealers: plan.maxDealers,
      features: plan.features,
      isActive: plan.isActive,
    };
    if (description !== undefined) plan.description = String(description);
    if (price !== undefined) plan.price = Number(price);
    if (currency !== undefined) plan.currency = String(currency).trim().toUpperCase();
    if (defaultDurationDays !== undefined) plan.defaultDurationDays = Number(defaultDurationDays);
    if (maxUsers !== undefined) plan.maxUsers = Number(maxUsers);
    if (maxDealers !== undefined) plan.maxDealers = Number(maxDealers);
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = Boolean(isActive);
    await plan.save();
    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      action: 'subscription_plan_updated',
      module: 'plans',
      description: `${plan.name} plan updated`,
      previousValue,
      newValue: {
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        defaultDurationDays: plan.defaultDurationDays,
        maxUsers: plan.maxUsers,
        maxDealers: plan.maxDealers,
        features: plan.features,
        isActive: plan.isActive,
      },
      ipAddress: req.ip,
    });
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update plan.' });
  }
};

exports.getFeatureCatalog = async (req, res) => {
  res.json({ success: true, data: PLATFORM_FEATURES });
};

exports.getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ updatedAt: -1 }).lean();
    const rows = await Promise.all(subscriptions.map(async (subscription) => {
      const company = await Company.findById(subscription.companyId).select('name email tenantId status').lean();
      return {
        ...subscription,
        company: company || null,
        daysRemaining: subscription.expiryDate ? daysRemaining(subscription.expiryDate) : 0,
      };
    }));
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load subscriptions.' });
  }
};

exports.updateSubscriptionStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Subscription status must be active or suspended.' });
    }
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found.' });
    const company = await Company.findById(subscription.companyId);
    if (!company) return res.status(404).json({ success: false, message: 'Subscription company not found.' });
    if (status === 'active') {
      if (subscription.paymentStatus !== 'paid') {
        return res.status(409).json({ success: false, message: 'Verify a payment before activating this subscription.' });
      }
      if (!subscription.expiryDate || new Date(subscription.expiryDate) <= new Date()) {
        return res.status(409).json({ success: false, message: 'This subscription has expired. Record and verify a renewal payment first.' });
      }
      if (company.status !== 'active') {
        return res.status(409).json({ success: false, message: 'Activate the suspended company before activating its subscription.' });
      }
    }

    const previousStatus = subscription.status;
    subscription.status = status;
    if (status === 'active') subscription.activatedBy = req.platformAdmin.email;
    await subscription.save();
    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: status === 'active' ? 'subscription_activated' : 'subscription_suspended',
      module: 'subscription',
      description: `Subscription ${status === 'active' ? 'activated' : 'suspended'} by platform admin`,
      previousValue: { status: previousStatus },
      newValue: { status },
      ipAddress: req.ip,
    });
    res.json({ success: true, data: { company, subscription } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update subscription status.' });
  }
};

exports.getPlatformUsers = async (req, res) => {
  try {
    const companies = await Company.find().select('name email tenantId').sort({ name: 1 }).lean();
    const usersByCompany = await Promise.all(companies.map(async (company) => {
      const users = await withTenantContext(tenantContextFor(company), async () => (
        User.find({ status: { $ne: 'deleted' } })
          .select('_id name email role status createdAt lastLogin')
          .sort({ createdAt: -1 })
          .lean()
      ));
      return users.map((user) => ({
        ...user,
        company: { _id: company._id, name: company.name, email: company.email },
      }));
    }));
    res.json({ success: true, data: usersByCompany.flat() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load company users.' });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const payments = await SubscriptionPayment.find().sort({ createdAt: -1 }).lean();
    const rows = await Promise.all(payments.map(async (payment) => {
      const [company, paymentPlan, subscription] = await Promise.all([
        Company.findById(payment.companyId).select('name email').lean(),
        payment.planId ? SubscriptionPlan.findById(payment.planId).select('name code').lean() : Promise.resolve(null),
        Subscription.findById(payment.subscriptionId).select('planName planCode').lean(),
      ]);
      return {
        ...payment,
        company: company || null,
        planName: paymentPlan?.name || subscription?.planName || subscription?.planCode || '—',
      };
    }));
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load payments.' });
  }
};

exports.recordManualPayment = async (req, res) => {
  try {
    const { companyId, planCode, amount, currency, paymentMethod, transactionReference } = req.body || {};
    if (!mongoose.isValidObjectId(companyId)) {
      return res.status(400).json({ success: false, message: 'A valid company is required.' });
    }
    const numericAmount = Number(amount);
    if (amount === undefined || amount === null || amount === '' || !Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be zero or greater.' });
    }
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    const plan = await SubscriptionPlan.findOne({ code: String(planCode || '').toUpperCase() });
    if (!plan) return res.status(400).json({ success: false, message: 'Select a valid Basic or Pro plan.' });
    if (!plan.isActive) return res.status(409).json({ success: false, message: 'This plan is inactive and cannot be assigned.' });

    let subscription = await Subscription.findOne({ companyId: company._id });
    if (!subscription) {
      subscription = await Subscription.create({
        companyId: company._id,
        tenantId: company.tenantId,
        planId: plan._id,
        planName: plan.name,
        planCode: plan.code,
        planSnapshot: {
          name: plan.name,
          code: plan.code,
          price: plan.price,
          currency: plan.currency,
          maxUsers: plan.maxUsers,
          maxDealers: plan.maxDealers,
          features: plan.features,
        },
        status: 'pending',
        durationDays: plan.defaultDurationDays,
        maxUsers: plan.maxUsers,
        maxDealers: plan.maxDealers,
        assignedFeatures: plan.features,
        paymentStatus: 'pending',
      });
    }

    const payment = await SubscriptionPayment.create({
      companyId: company._id,
      subscriptionId: subscription._id,
      planId: plan._id,
      amount: numericAmount,
      currency: String(currency || plan.currency || 'INR').trim().toUpperCase(),
      paymentMethod: String(paymentMethod || 'manual').trim().slice(0, 80),
      transactionReference: String(transactionReference || '').trim().slice(0, 160),
      paymentStatus: 'pending',
    });
    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: 'manual_payment_recorded',
      module: 'payment',
      description: `Manual payment recorded for ${plan.name}; verification is pending`,
      newValue: { amount: payment.amount, currency: payment.currency, planCode: plan.code, paymentStatus: 'pending' },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to record manual payment.' });
  }
};

exports.verifyManualPayment = async (req, res) => {
  try {
    const payment = await SubscriptionPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });
    if (payment.paymentStatus !== 'pending') {
      return res.status(409).json({ success: false, message: 'Only pending payments can be verified.' });
    }
    const [company, subscription, plan] = await Promise.all([
      Company.findById(payment.companyId),
      Subscription.findById(payment.subscriptionId),
      payment.planId ? SubscriptionPlan.findById(payment.planId) : null,
    ]);
    if (!company || !subscription) {
      return res.status(404).json({ success: false, message: 'The company subscription for this payment could not be found.' });
    }
    const selectedPlan = plan || await SubscriptionPlan.findById(subscription.planId);
    if (!selectedPlan) return res.status(409).json({ success: false, message: 'The subscription plan for this payment no longer exists.' });
    const now = new Date();
    const oldExpiry = subscription.expiryDate ? new Date(subscription.expiryDate) : null;
    const renewalStart = oldExpiry && oldExpiry > now ? oldExpiry : now;
    const durationDays = Number(selectedPlan.defaultDurationDays || 365);
    const nextExpiry = new Date(renewalStart.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const previousValue = {
      paymentStatus: payment.paymentStatus,
      subscriptionStatus: subscription.status,
      planCode: subscription.planCode,
      expiryDate: subscription.expiryDate,
    };

    const verifiedPayment = await SubscriptionPayment.findOneAndUpdate(
      { _id: payment._id, paymentStatus: 'pending' },
      { $set: { paymentStatus: 'paid', paidAt: now } },
      { new: true },
    );
    if (!verifiedPayment) {
      return res.status(409).json({ success: false, message: 'This payment was already reviewed. Refresh the payment list.' });
    }

    subscription.planId = selectedPlan._id;
    subscription.planName = selectedPlan.name;
    subscription.planCode = selectedPlan.code;
    subscription.planSnapshot = {
      name: selectedPlan.name,
      code: selectedPlan.code,
      price: selectedPlan.price,
      currency: selectedPlan.currency,
      maxUsers: selectedPlan.maxUsers,
      maxDealers: selectedPlan.maxDealers,
      features: selectedPlan.features,
    };
    subscription.status = 'active';
    subscription.startDate = subscription.startDate || renewalStart;
    subscription.expiryDate = nextExpiry;
    subscription.durationDays = durationDays;
    subscription.maxUsers = selectedPlan.maxUsers;
    subscription.maxDealers = selectedPlan.maxDealers;
    subscription.assignedFeatures = selectedPlan.features;
    subscription.paymentStatus = 'paid';
    subscription.activatedBy = req.platformAdmin.email;
    await subscription.save();

    company.plan = selectedPlan.code.toLowerCase();
    company.status = 'active';
    await company.save();
    await createAuditEntry({
      actorId: req.platformAdmin._id,
      actorType: 'platform_admin',
      companyId: company._id,
      action: 'manual_payment_verified',
      module: 'payment',
      description: `Payment verified and ${selectedPlan.name} subscription activated`,
      previousValue,
      newValue: {
        paymentStatus: 'paid',
        subscriptionStatus: 'active',
        planCode: selectedPlan.code,
        expiryDate: nextExpiry,
      },
      ipAddress: req.ip,
    });
    res.json({ success: true, data: { payment: verifiedPayment, subscription, company } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to verify payment and activate subscription.' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
    const rows = await Promise.all(logs.map(async (log) => {
      const [company, admin] = await Promise.all([
        log.companyId ? Company.findById(log.companyId).select('name').lean() : null,
        log.actorId ? PlatformAdmin.findById(log.actorId).select('name email').lean() : null,
      ]);
      return { ...log, company: company?.name || 'Platform', admin: admin?.name || 'System' };
    }));
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load audit logs.' });
  }
};

exports.getCompanySubscription = async (req, res) => {
  try {
    const company = req.company;
    const subscription = await Subscription.findOne({ companyId: company._id }).lean();
    res.json({ success: true, data: subscription || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch company subscription.' });
  }
};

exports.getCompanySubscriptionStatus = async (req, res) => {
  try {
    const company = req.company;
    const subscription = await Subscription.findOne({ companyId: company._id }).lean();
    const status = subscription ? { ...subscription, daysRemaining: subscription.expiryDate ? daysRemaining(subscription.expiryDate) : 0 } : null;
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch company subscription status.' });
  }
};

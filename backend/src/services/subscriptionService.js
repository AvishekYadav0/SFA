const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { withTenantContext } = require('../utils/tenantContext');
const { tenantContextFor } = require('../utils/tenantModels');
const { BASIC_FEATURES, PRO_FEATURES } = require('./platformFeatureCatalog');

const DEFAULT_DURATION_DAYS = 365;

function asUtcDate(date) {
  if (!date) return null;
  const normalized = new Date(date);
  return new Date(normalized.toISOString());
}

function buildPlanSnapshot(plan) {
  if (!plan) return null;
  return {
    name: plan.name,
    code: plan.code,
    price: Number(plan.price || 0),
    currency: plan.currency || 'INR',
    maxUsers: Number(plan.maxUsers || 1),
    maxDealers: Number(plan.maxDealers || 0),
    features: Array.isArray(plan.features) ? plan.features : [],
  };
}

async function ensureDefaultPlans() {
  const defaults = [
    { name: 'Basic', code: 'BASIC', description: 'Core SFA access', price: 0, currency: 'INR', defaultDurationDays: DEFAULT_DURATION_DAYS, maxUsers: 10, maxDealers: 20, features: BASIC_FEATURES, isActive: true },
    { name: 'Pro', code: 'PRO', description: 'Full SFA access', price: 0, currency: 'INR', defaultDurationDays: DEFAULT_DURATION_DAYS, maxUsers: 100, maxDealers: 1000, features: PRO_FEATURES, isActive: true },
  ];
  const previousDefaults = {
    BASIC: ['dashboard', 'dealers', 'team_management', 'products', 'orders', 'sales', 'collections', 'basic_reports'],
    PRO: ['dashboard', 'dealers', 'team_management', 'products', 'orders', 'sales', 'collections', 'basic_reports', 'pipeline', 'collection_plans', 'monthly_planning', 'gps_visit_tracking', 'stock_management', 'advanced_reports'],
  };

  for (const planData of defaults) {
    const existing = await SubscriptionPlan.findOne({ code: planData.code });
    if (!existing) {
      await SubscriptionPlan.create(planData);
    } else {
      const oldFeatures = previousDefaults[planData.code];
      const existingFeatures = Array.isArray(existing.features) ? existing.features : [];
      if (existingFeatures.length === oldFeatures.length && oldFeatures.every(feature => existingFeatures.includes(feature))) {
        existing.features = planData.features;
        await existing.save();
      }
    }
  }

  return SubscriptionPlan.find({ code: { $in: ['BASIC', 'PRO'] } }).sort({ code: 1 }).lean();
}

async function ensureCompanySubscription(company, options = {}) {
  const fallbackPlan = await SubscriptionPlan.findOne({ code: options.planCode || 'BASIC' }).lean();
  if (!fallbackPlan) {
    await ensureDefaultPlans();
  }

  const companyId = company?._id || company;
  const tenantId = company?.tenantId || company?.tenantId || null;
  let subscription = await Subscription.findOne({ companyId });
  if (!subscription) {
    const plan = await SubscriptionPlan.findOne({ code: options.planCode || 'BASIC' });
    const startDate = asUtcDate(options.startDate || new Date());
    const durationDays = Number(options.durationDays || plan?.defaultDurationDays || DEFAULT_DURATION_DAYS);
    const expiryDate = options.status === 'pending'
      ? null
      : asUtcDate(new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000)));
    subscription = await Subscription.create({
      companyId,
      tenantId,
      planId: plan?._id || null,
      planName: plan?.name || 'Basic',
      planCode: plan?.code || 'BASIC',
      planSnapshot: buildPlanSnapshot(plan),
      status: options.status || 'active',
      startDate: options.status === 'pending' ? null : startDate,
      expiryDate,
      durationDays,
      maxUsers: Number(options.maxUsers || plan?.maxUsers || 10),
      maxDealers: Number(options.maxDealers || plan?.maxDealers || 20),
      assignedFeatures: Array.isArray(options.features) ? options.features : (plan?.features || []),
      gracePeriodDays: Number(options.gracePeriodDays || 7),
      paymentStatus: options.paymentStatus || 'paid',
      activatedBy: options.activatedBy || 'system',
    });
  }

  if (options.planCode || options.planName || options.features !== undefined || options.maxUsers !== undefined || options.maxDealers !== undefined || options.durationDays !== undefined || options.status) {
    const plan = options.planCode ? await SubscriptionPlan.findOne({ code: options.planCode }) : await SubscriptionPlan.findById(subscription.planId);
    if (plan) {
      subscription.planId = plan._id;
      subscription.planName = plan.name;
      subscription.planCode = plan.code;
      subscription.planSnapshot = buildPlanSnapshot(plan);
      if (options.maxUsers === undefined && !subscription.maxUsers) subscription.maxUsers = plan.maxUsers;
      if (options.maxDealers === undefined && !subscription.maxDealers) subscription.maxDealers = plan.maxDealers;
      if (options.features === undefined && !subscription.assignedFeatures.length) subscription.assignedFeatures = plan.features;
    }
    if (options.maxUsers !== undefined) subscription.maxUsers = Number(options.maxUsers);
    if (options.maxDealers !== undefined) subscription.maxDealers = Number(options.maxDealers);
    if (options.features !== undefined) subscription.assignedFeatures = Array.isArray(options.features) ? options.features : [];
    if (options.durationDays !== undefined) {
      const durationDays = Number(options.durationDays);
      subscription.durationDays = durationDays;
      const start = subscription.startDate || new Date();
      subscription.expiryDate = asUtcDate(new Date(start.getTime() + (durationDays * 24 * 60 * 60 * 1000)));
    }
    if (options.gracePeriodDays !== undefined) subscription.gracePeriodDays = Number(options.gracePeriodDays);
    if (options.status) subscription.status = options.status;
    if (options.paymentStatus) subscription.paymentStatus = options.paymentStatus;
    await subscription.save();
  }

  return subscription;
}

function daysRemaining(expiryDate) {
  if (!expiryDate) return 0;
  const now = new Date();
  const end = new Date(expiryDate);
  const msLeft = end.getTime() - now.getTime();
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
}

async function getCompanySubscription(companyId) {
  return Subscription.findOne({ companyId }).lean();
}

async function evaluateSubscriptionStatus(subscription) {
  if (!subscription) return null;
  const now = new Date();
  if (subscription.status === 'cancelled') return subscription;
  const graceDays = Number(subscription.gracePeriodDays || 0);
  const expiry = subscription.expiryDate ? new Date(subscription.expiryDate) : null;
  const graceExpiry = expiry && graceDays > 0 ? new Date(expiry.getTime() + (graceDays * 24 * 60 * 60 * 1000)) : null;

  let nextStatus = subscription.status;
  if (expiry && now > expiry && (!graceExpiry || now > graceExpiry)) {
    nextStatus = 'expired';
  } else if (expiry && now > expiry && graceExpiry && now <= graceExpiry) {
    nextStatus = 'past_due';
  } else if (subscription.status === 'suspended') {
    nextStatus = 'suspended';
  } else if (subscription.paymentStatus === 'pending') {
    nextStatus = 'pending';
  } else {
    nextStatus = 'active';
  }

  if (nextStatus !== subscription.status) {
    subscription.status = nextStatus;
    await Subscription.updateOne({ _id: subscription._id }, { status: nextStatus });
  }

  return await Subscription.findById(subscription._id).lean();
}

async function companyUserLimit(company) {
  const connectionContext = tenantContextFor(company);
  return withTenantContext(connectionContext, async () => {
    const activeUsers = await User.countDocuments({ status: 'active' });
    const users = await User.find({ status: 'active' }).select('_id name email role status').lean();
    return { activeUsers, users };
  });
}

async function canAccessFeature(companyId, feature) {
  const subscription = await Subscription.findOne({ companyId: companyId }).lean();
  if (!subscription) return false;
  const status = await evaluateSubscriptionStatus(subscription);
  if (!status || !['active', 'past_due'].includes(status.status)) return false;
  const features = Array.isArray(status.assignedFeatures) ? status.assignedFeatures : [];
  return features.includes(feature);
}

async function createAuditEntry({ actorId, actorType, companyId, action, module, description, previousValue, newValue, ipAddress }) {
  return AuditLog.create({ actorId, actorType, companyId, action, module, description, previousValue, newValue, ipAddress });
}

module.exports = {
  DEFAULT_DURATION_DAYS,
  ensureDefaultPlans,
  ensureCompanySubscription,
  getCompanySubscription,
  evaluateSubscriptionStatus,
  companyUserLimit,
  canAccessFeature,
  createAuditEntry,
  buildPlanSnapshot,
  daysRemaining,
};

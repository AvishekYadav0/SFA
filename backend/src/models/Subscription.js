const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  tenantId: { type: String, required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
  planName: { type: String, default: 'Basic' },
  planCode: { type: String, default: 'BASIC', enum: ['BASIC', 'PRO'] },
  planSnapshot: {
    name: String,
    code: String,
    price: Number,
    currency: String,
    maxUsers: Number,
    maxDealers: Number,
    features: [String],
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'suspended', 'past_due', 'cancelled'],
    default: 'pending',
  },
  startDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null },
  durationDays: { type: Number, default: 365, min: 1 },
  maxUsers: { type: Number, default: 5, min: 1 },
  maxDealers: { type: Number, default: 10, min: 0 },
  assignedFeatures: { type: [String], default: [] },
  gracePeriodDays: { type: Number, default: 7, min: 0 },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  activatedBy: { type: String, default: null },
  notificationState: { type: Map, of: Date, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

subscriptionSchema.index({ companyId: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);

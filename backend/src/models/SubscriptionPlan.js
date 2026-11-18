const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, enum: ['Basic', 'Pro'], trim: true },
  code: { type: String, required: true, unique: true, enum: ['BASIC', 'PRO'], uppercase: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  defaultDurationDays: { type: Number, default: 365, min: 1 },
  maxUsers: { type: Number, default: 5, min: 1 },
  maxDealers: { type: Number, default: 10, min: 0 },
  features: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

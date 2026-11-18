const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
  amount: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  paymentMethod: { type: String, default: 'manual' },
  transactionReference: { type: String, default: '' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);

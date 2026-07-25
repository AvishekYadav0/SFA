const mongoose = require('mongoose');
const Counter = require('./Counter');

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, index: true },
  date: { type: Date, default: Date.now },
  salesperson: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson' },
  dealer: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  area: String,
  province: String,
  items: { type: Array, default: [] },
  totalBasicAmount: { type: Number, default: 0 },
  totalExciseAmount: { type: Number, default: 0 },
  totalVatAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
});

// Assign an atomic order number if not already set
OrderSchema.pre('validate', async function(next) {
  try {
    if (this.orderNumber) return next();
    const seq = await Counter.getNext('orderNumber');
    this.orderNumber = `ORD-${String(seq).padStart(5, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model('Order', OrderSchema);

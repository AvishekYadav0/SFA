const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  order:       { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  orderNumber: String,
  salesperson: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson' },
  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  province:    String,
  area:        String,
  grandTotal:  { type: Number, default: 0 },
  paymentType: { type: String, enum: ['cash', 'online', 'credit'], default: 'cash' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'warehouse', 'out_for_delivery', 'delivered', 'completed', 'rejected', 'cancelled'],
    default: 'pending',
  },
  staffId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

saleSchema.index({ status: 1 });
saleSchema.index({ province: 1 });

module.exports = mongoose.model('Sale', saleSchema);

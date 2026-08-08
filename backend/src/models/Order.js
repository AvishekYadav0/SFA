const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName:  String,
  ml:           String,
  up:           String,
  customerType: { type: String, enum: ['MM', 'ADPL'], default: 'MM' },
  quantity:     { type: Number, required: true },
  rate:         { type: Number, required: true },
  exciseAmount: { type: Number, default: 0 },
  vatAmount:    { type: Number, default: 0 },
  basicAmount:  Number,
  grandTotal:   Number,
});

const orderSchema = new mongoose.Schema({
  orderNumber:  { type: String, unique: true },
  date:         { type: Date, default: Date.now },

  // Hierarchy
  se:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  so:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asm:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rsm:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nsm:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  dealer:       { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  province:     String,
  district:     String,
  area:         String,
  region:       String,

  items:        [orderItemSchema],

  totalBasicAmount:  { type: Number, default: 0 },
  totalExciseAmount: { type: Number, default: 0 },
  totalVatAmount:    { type: Number, default: 0 },
  grandTotal:        { type: Number, default: 0 },

  paymentType:  { type: String, enum: ['cash', 'bank', 'credit', 'online'], default: 'cash' },
  status:       {
    type: String,
    enum: ['draft', 'pending', 'approved', 'hold', 'warehouse', 'out_for_delivery', 'packed', 'dispatched', 'delivered', 'completed', 'cancelled', 'rejected'],
    default: 'pending',
  },

  remarks:      String,
  approvalRemarks: String,

  approvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt:   Date,
  packedAt:     Date,
  dispatchedAt: Date,
  deliveredAt:  Date,
  completedAt:  Date,

  collectedAmount: { type: Number, default: 0 },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orderSchema.index({ se: 1, date: -1 });
orderSchema.index({ asm: 1, date: -1 });
orderSchema.index({ rsm: 1, date: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ dealer: 1 });

orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);

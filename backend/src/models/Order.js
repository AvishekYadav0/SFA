const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName:   String,
  quantity:      { type: Number, required: true },
  rate:          { type: Number, required: true },
  excisePercent: { type: Number, default: 0 },
  vatPercent:    { type: Number, default: 0 },
  basicAmount:   Number,
  exciseAmount:  Number,
  vatAmount:     Number,
  grandTotal:    Number,
});

const orderSchema = new mongoose.Schema({
  orderNumber:       { type: String, unique: true },
  date:              { type: Date, required: true, default: Date.now },
  salesperson:       { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson', required: true },
  dealer:            { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  area:              String,
  province:          { type: String, default: '' },
  staffId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items:             [orderItemSchema],
  totalBasicAmount:  { type: Number, default: 0 },
  totalExciseAmount: { type: Number, default: 0 },
  totalVatAmount:    { type: Number, default: 0 },
  grandTotal:        { type: Number, default: 0 },
  remarks:           String,
  status:            { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orderSchema.index({ date: -1 });
orderSchema.index({ salesperson: 1, date: -1 });
orderSchema.index({ staffId: 1, date: -1 });
orderSchema.index({ status: 1 });

orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);

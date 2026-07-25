const mongoose = require('mongoose');
const Counter = require('./Counter');

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
  collectedAmount:   { type: Number, default: 0 },
  paymentMethod:     { type: String, enum: ['cash', 'bank', 'esewa', 'fonepay', 'cheque', 'credit', ''], default: '' },
  remarks:           String,
  status:            { type: String, enum: ['pending', 'approved', 'warehouse', 'out_for_delivery', 'delivered', 'completed', 'rejected', 'cancelled'], default: 'pending' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orderSchema.index({ date: -1 });
orderSchema.index({ salesperson: 1, date: -1 });
orderSchema.index({ staffId: 1, date: -1 });
orderSchema.index({ status: 1 });

orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const lastOrder = await mongoose.model('Order').findOne({ orderNumber: /^ORD-\d{5}$/ })
      .sort({ orderNumber: -1 })
      .select('orderNumber')
      .lean();

    const maxSeq = lastOrder ? Number(lastOrder.orderNumber.slice(4)) : 0;
    const counter = await Counter.findOneAndUpdate(
      { _id: 'orderNumber' },
      [
        {
          $set: {
            seq: {
              $cond: [
                { $gt: ['$seq', maxSeq] },
                { $add: ['$seq', 1] },
                maxSeq + 1,
              ],
            },
          },
        },
      ],
      { new: true, upsert: true }
    );

    this.orderNumber = `ORD-${String(counter.seq).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);


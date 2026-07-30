const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  order:       { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  orderNumber: { type: String, unique: true, sparse: true },
  invoiceNumber:{ type: String, unique: true, sparse: true },
  manualSaleId: { type: String, unique: true, sparse: true },
  salesperson: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesperson' },
  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  province:    String,
  area:        String,
  date:        { type: Date, default: Date.now },
  items:       [{
    product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName:  String,
    quantity:     { type: Number, default: 0 },
    rate:         { type: Number, default: 0 },
    discountPercent:{ type: Number, default: 0 },
    discountAmount:{ type: Number, default: 0 },
    excisePercent:{ type: Number, default: 0 },
    vatPercent:   { type: Number, default: 0 },
    basicAmount:  Number,
    exciseAmount: Number,
    vatAmount:    Number,
    grandTotal:   Number,
  }],
  grandTotal:  { type: Number, default: 0 },
  collectedAmount: { type: Number, default: 0 },
  paymentType: { type: String, enum: ['cash', 'online', 'credit', 'bank', 'esewa', 'fonepay', 'cheque'], default: 'cash' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'warehouse', 'out_for_delivery', 'delivered', 'completed', 'rejected', 'cancelled', 'hold'],
    default: 'pending',
  },
  staffId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks:    String,
}, { timestamps: true });

saleSchema.index({ order: 1 }, {
  unique: true,
  partialFilterExpression: { order: { $type: 'objectId' } },
  name: 'sale_order_unique_partial',
});
saleSchema.index({ status: 1 });
saleSchema.index({ province: 1 });

module.exports = mongoose.model('Sale', saleSchema);

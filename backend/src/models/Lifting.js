const mongoose = require('mongoose');

const liftingSchema = new mongoose.Schema({
  order:             { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber:       String,
  dealer:            { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  product:           { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName:       String,
  province:          { type: String, required: true },
  staffId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  orderedQuantity:   { type: Number, required: true },
  week1:             { type: Number, default: 0 },
  week2:             { type: Number, default: 0 },
  week3:             { type: Number, default: 0 },
  week4:             { type: Number, default: 0 },
  totalLifted:       { type: Number, default: 0 },
  remainingQuantity: { type: Number, default: 0 },
  progressPercent:   { type: Number, default: 0 },
  month:             String,
  year:              Number,
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

liftingSchema.pre('save', function (next) {
  this.totalLifted       = this.week1 + this.week2 + this.week3 + this.week4;
  this.remainingQuantity = this.orderedQuantity - this.totalLifted;
  this.progressPercent   = this.orderedQuantity > 0
    ? Math.min(100, Math.round((this.totalLifted / this.orderedQuantity) * 100))
    : 0;
  next();
});

module.exports = mongoose.model('Lifting', liftingSchema);

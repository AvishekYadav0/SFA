const mongoose = require('mongoose');

const collectionPlanSchema = new mongoose.Schema({
  dealer: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  month: String,
  province: String,
  openingBalance: { type: Number, default: 0, min: 0 },
  currentOrderAmount: { type: Number, default: 0, min: 0 },
  week1: { type: Number, default: 0, min: 0 },
  week2: { type: Number, default: 0, min: 0 },
  week3: { type: Number, default: 0, min: 0 },
  week4: { type: Number, default: 0, min: 0 },
  remarks: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

collectionPlanSchema.virtual('totalDue').get(function () {
  return this.openingBalance + this.currentOrderAmount;
});
collectionPlanSchema.virtual('totalCollection').get(function () {
  return this.week1 + this.week2 + this.week3 + this.week4;
});
collectionPlanSchema.virtual('closingBalance').get(function () {
  return this.totalDue - this.totalCollection;
});
collectionPlanSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('CollectionPlan', collectionPlanSchema);
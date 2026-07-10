const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  dealer:              { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  dealerName:          String,
  province:            { type: String, required: true },
  staffId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  openingBalance:      { type: Number, default: 0 },
  currentOrderAmount:  { type: Number, default: 0 },
  totalDue:            { type: Number, default: 0 },
  week1:               { type: Number, default: 0 },
  week2:               { type: Number, default: 0 },
  week3:               { type: Number, default: 0 },
  week4:               { type: Number, default: 0 },
  totalCollection:     { type: Number, default: 0 },
  closingBalance:      { type: Number, default: 0 },
  month:               String,
  year:                Number,
  remarks:             String,
  createdBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

collectionSchema.pre('save', function (next) {
  this.totalDue        = this.openingBalance + this.currentOrderAmount;
  this.totalCollection = this.week1 + this.week2 + this.week3 + this.week4;
  this.closingBalance  = this.totalDue - this.totalCollection;
  next();
});

module.exports = mongoose.model('Collection', collectionSchema);

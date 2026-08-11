const mongoose = require('mongoose');

const dealerLedgerSchema = new mongoose.Schema({
  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  sale:        { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  collection:  { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
  date:        { type: Date, default: Date.now },
  type:        { type: String, enum: ['sale', 'collection'], required: true },
  debit:       { type: Number, default: 0 },
  credit:      { type: Number, default: 0 },
  balance:     { type: Number, default: 0 },
  reference:   String,
  remarks:     String,
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

dealerLedgerSchema.index({ dealer: 1, date: -1 });

module.exports = mongoose.model('DealerLedger', dealerLedgerSchema);
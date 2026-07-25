const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  staffId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dealerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  period:            { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
  month:             String,   // e.g. "2025-01"
  quarter:           String,   // e.g. "2025-Q1"
  year:              Number,
  salesTarget:       { type: Number, default: 0 },
  collectionTarget:  { type: Number, default: 0 },
  province:          String,
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

targetSchema.index({ staffId: 1, period: 1, month: 1 });
targetSchema.index({ staffId: 1, period: 1, year: 1 });

module.exports = mongoose.model('Target', targetSchema);

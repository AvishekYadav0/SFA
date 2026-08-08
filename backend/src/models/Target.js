const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:        { type: String, enum: ['nsm', 'rsm', 'asm', 'se', 'so'] },
  month:       { type: Number, required: true }, // 1-12
  year:        { type: Number, required: true },
  salesTarget: { type: Number, default: 0 },
  collectionTarget: { type: Number, default: 0 },
  visitTarget: { type: Number, default: 0 },
  dealerTarget: { type: Number, default: 0 },
  province:    String,
  region:      String,
  setBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

targetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Target', targetSchema);

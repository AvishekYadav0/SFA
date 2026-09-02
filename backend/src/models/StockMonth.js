const mongoose = require('mongoose');

const stockMonthSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 2000,
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN',
  },
  closedAt:   { type: Date, default: null },
  closedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reopenedAt: { type: Date, default: null },
  reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// ── Unique index: one record per month+year ───────────────────────────────────
stockMonthSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('StockMonth', stockMonthSchema);

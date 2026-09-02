const mongoose = require('mongoose');

const dealerProductStockSettingSchema = new mongoose.Schema({
  dealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dealer',
    required: [true, 'Dealer is required'],
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
  },
  minimumStock: {
    type: Number,
    default: 0,
    min: [0, 'Minimum stock must be >= 0'],
  },
}, { timestamps: true });

// ── Unique compound index: one setting per dealer+product ─────────────────────
dealerProductStockSettingSchema.index({ dealer: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('DealerProductStockSetting', dealerProductStockSettingSchema);

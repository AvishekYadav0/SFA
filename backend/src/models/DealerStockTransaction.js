const mongoose = require('mongoose');

const TRANSACTION_TYPES = [
  'OPENING',
  'COMPANY_DISPATCH',
  'DEALER_SALE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'DAMAGE',
  'EXPIRED',
  'SAMPLE',
  'PROMOTIONAL',
  'RETURN_TO_COMPANY',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
];

const dealerStockTransactionSchema = new mongoose.Schema({
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
  transactionDate: {
    type: Date,
    required: [true, 'Transaction date is required'],
    default: Date.now,
  },
  transactionType: {
    type: String,
    enum: TRANSACTION_TYPES,
    required: [true, 'Transaction type is required'],
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity must be >= 0'],
  },
  // Reference to source document (Order, Transfer, etc.)
  referenceType: {
    type: String,
    enum: ['Order', 'Transfer', 'Adjustment', 'Manual', 'Opening', 'Sale', null],
    default: null,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  // For TRANSFER_IN / TRANSFER_OUT
  sourceDealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dealer',
    default: null,
  },
  destinationDealer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dealer',
    default: null,
  },
  reason:  { type: String, default: '' },
  remarks: { type: String, default: '' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'createdBy is required'],
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
dealerStockTransactionSchema.index({ dealer: 1 });
dealerStockTransactionSchema.index({ product: 1 });
dealerStockTransactionSchema.index({ transactionDate: -1 });
dealerStockTransactionSchema.index({ dealer: 1, product: 1, transactionDate: -1 });

module.exports = mongoose.model('DealerStockTransaction', dealerStockTransactionSchema);

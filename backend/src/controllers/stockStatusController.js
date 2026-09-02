const mongoose = require('mongoose');
const DealerStockTransaction = require('../models/DealerStockTransaction');
const { getStockSummary, getStockLedger } = require('../utils/stockService');

const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const resolveMonth = (m) => {
  if (!m) return undefined;
  const n = parseInt(m);
  if (!isNaN(n)) return n;
  const idx = MONTH_NAMES.indexOf(m.toLowerCase());
  return idx >= 0 ? idx + 1 : undefined;
};

// GET /api/stock-status
exports.getStockStatus = async (req, res) => {
  try {
    const { dealerId, productId, area, region, month, year } = req.query;
    const monthNum = resolveMonth(month);
    const { summary, products } = await getStockSummary({ dealerId, productId, area, region, month: monthNum, year });
    res.json({ success: true, data: { summary, products } });
  } catch (err) {
    console.error('Stock status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/stock-status/dealer/:dealerId/product/:productId/ledger
exports.getStockLedger = async (req, res) => {
  try {
    const { dealerId, productId } = req.params;
    const { month, year } = req.query;
    const monthNum = resolveMonth(month);
    const { ledger, closingBalance } = await getStockLedger(dealerId, productId, { month: monthNum, year });
    res.json({ success: true, data: { ledger, closingBalance } });
  } catch (err) {
    console.error('Stock ledger error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── helpers ───────────────────────────────────────────────────────────────────
const OUTGOING_TYPES = ['DEALER_SALE','TRANSFER_OUT','DAMAGE','EXPIRED','SAMPLE','PROMOTIONAL','RETURN_TO_COMPANY','ADJUSTMENT_OUT'];
const INCOMING_TYPES = ['OPENING','COMPANY_DISPATCH','TRANSFER_IN','ADJUSTMENT_IN'];

/**
 * Calculate current closing stock for a dealer+product from all transactions.
 * Returns a number (0 if no transactions).
 */
async function getClosingStock(dealerId, productId) {
  if (!mongoose.isValidObjectId(dealerId) || !mongoose.isValidObjectId(productId)) return 0;
  const result = await DealerStockTransaction.aggregate([
    { $match: { dealer: new mongoose.Types.ObjectId(dealerId), product: new mongoose.Types.ObjectId(productId) } },
    { $group: {
      _id: null,
      incoming: { $sum: { $cond: [{ $in: ['$transactionType', INCOMING_TYPES] }, '$quantity', 0] } },
      outgoing: { $sum: { $cond: [{ $in: ['$transactionType', OUTGOING_TYPES] }, '$quantity', 0] } },
    }},
    { $project: { closing: { $subtract: ['$incoming', '$outgoing'] } } },
  ]);
  console.log(`[getClosingStock] dealer=${dealerId} product=${productId} result=`, result);
  return result[0]?.closing ?? 0;
}

// POST /api/stock-status/dealer-sales
exports.recordDealerSales = async (req, res) => {
  try {
    const { dealerId, productId, quantity, transactionDate, remarks } = req.body;
    if (!dealerId || !productId || !quantity)
      return res.status(400).json({ success: false, message: 'dealerId, productId and quantity are required' });

    const qty = Number(quantity);
    if (qty <= 0)
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });

    const available = await getClosingStock(dealerId, productId);
    if (qty > available)
      return res.status(400).json({
        success: false,
        message: `Insufficient dealer stock. Available quantity: ${available}`,
        available,
      });

    const tx = await DealerStockTransaction.create({
      dealer:          dealerId,
      product:         productId,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      transactionType: 'DEALER_SALE',
      quantity:        qty,
      referenceType:   'Manual',
      remarks:         remarks || '',
      createdBy:       req.user._id,
    });

    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    console.error('Dealer sales error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/stock-status/adjustments
exports.createAdjustment = async (req, res) => {
  try {
    const { dealerId, productId, quantity, transactionType, transactionDate, reason, remarks } = req.body;

    const ADJUSTMENT_TYPES = ['DAMAGE','EXPIRED','SAMPLE','PROMOTIONAL','RETURN_TO_COMPANY','ADJUSTMENT_IN','ADJUSTMENT_OUT'];
    if (!ADJUSTMENT_TYPES.includes(transactionType))
      return res.status(400).json({ success: false, message: `Invalid adjustment type. Allowed: ${ADJUSTMENT_TYPES.join(', ')}` });

    if (!dealerId || !productId || !quantity)
      return res.status(400).json({ success: false, message: 'dealerId, productId and quantity are required' });

    if (!reason || !reason.trim())
      return res.status(400).json({ success: false, message: 'Reason is required for adjustments' });

    const qty = Number(quantity);
    if (qty <= 0)
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });

    // For outgoing adjustments, check available stock
    if (OUTGOING_TYPES.includes(transactionType)) {
      const available = await getClosingStock(dealerId, productId);
      if (qty > available)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for adjustment. Available quantity: ${available}`,
          available,
        });
    }

    const tx = await DealerStockTransaction.create({
      dealer:          dealerId,
      product:         productId,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      transactionType,
      quantity:        qty,
      referenceType:   'Adjustment',
      reason:          reason.trim(),
      remarks:         remarks || '',
      createdBy:       req.user._id,
    });

    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    console.error('Adjustment error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/stock-status/transaction  — record a single transaction
exports.createTransaction = async (req, res) => {
  try {
    const {
      dealer, product, transactionDate, transactionType,
      quantity, referenceType, referenceId,
      sourceDealer, destinationDealer, reason, remarks,
    } = req.body;

    const tx = await DealerStockTransaction.create({
      dealer, product,
      transactionDate: transactionDate || new Date(),
      transactionType,
      quantity,
      referenceType:     referenceType     || null,
      referenceId:       referenceId       || null,
      sourceDealer:      sourceDealer      || null,
      destinationDealer: destinationDealer || null,
      reason,
      remarks,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/stock-status/transfers  — atomic dealer-to-dealer transfer (MongoDB session)
exports.createTransfer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { sourceDealerId, destinationDealerId, productId, quantity, transactionDate, remarks } = req.body;

    if (!sourceDealerId || !destinationDealerId || !productId || !quantity)
      return res.status(400).json({ success: false, message: 'sourceDealerId, destinationDealerId, productId and quantity are required' });
    if (String(sourceDealerId) === String(destinationDealerId))
      return res.status(400).json({ success: false, message: 'Source and destination dealer cannot be the same' });

    const qty = Number(quantity);
    if (qty <= 0)
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });

    // Check source stock BEFORE opening session (read outside tx is fine — we re-validate inside)
    const available = await getClosingStock(sourceDealerId, productId);
    if (qty > available)
      return res.status(400).json({
        success: false,
        message: `Insufficient dealer stock. Available quantity: ${available}`,
        available,
      });

    const date = transactionDate ? new Date(transactionDate) : new Date();
    const base = {
      product:         productId,
      transactionDate: date,
      quantity:        qty,
      referenceType:   'Transfer',
      remarks:         remarks || '',
      createdBy:       req.user._id,
    };

    let transferOut, transferIn;
    await session.withTransaction(async () => {
      [transferOut] = await DealerStockTransaction.create(
        [{ ...base, dealer: sourceDealerId,      transactionType: 'TRANSFER_OUT', destinationDealer: destinationDealerId }],
        { session }
      );
      [transferIn] = await DealerStockTransaction.create(
        [{ ...base, dealer: destinationDealerId, transactionType: 'TRANSFER_IN',  sourceDealer: sourceDealerId }],
        { session }
      );
    });

    res.status(201).json({ success: true, data: { transferOut, transferIn } });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(400).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

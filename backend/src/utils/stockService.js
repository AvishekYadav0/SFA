const mongoose = require('mongoose');
const DealerStockTransaction = require('../models/DealerStockTransaction');

const INCOMING = ['OPENING', 'COMPANY_DISPATCH', 'TRANSFER_IN', 'ADJUSTMENT_IN'];
const OUTGOING = ['DEALER_SALE', 'TRANSFER_OUT', 'DAMAGE', 'EXPIRED', 'SAMPLE', 'PROMOTIONAL', 'RETURN_TO_COMPANY', 'ADJUSTMENT_OUT'];

const monthRange = (month, year) => {
  const m = parseInt(month);
  const y = parseInt(year);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
};

// Build accumulators — movement columns optionally date-filtered, closingStock always all-time
const buildAccumulators = (dateStart, dateEnd) => {
  const inRange = dateStart
    ? { $and: [{ $gte: ['$transactionDate', dateStart] }, { $lt: ['$transactionDate', dateEnd] }] }
    : null;

  const cond = (type) => inRange
    ? { $and: [inRange, { $eq: ['$transactionType', type] }] }
    : { $eq: ['$transactionType', type] };

  return {
    openingStock:    { $sum: { $cond: [cond('OPENING'),           '$quantity', 0] } },
    companyDispatch: { $sum: { $cond: [cond('COMPANY_DISPATCH'),  '$quantity', 0] } },
    transferIn:      { $sum: { $cond: [cond('TRANSFER_IN'),       '$quantity', 0] } },
    adjustmentIn:    { $sum: { $cond: [cond('ADJUSTMENT_IN'),     '$quantity', 0] } },
    dealerSales:     { $sum: { $cond: [cond('DEALER_SALE'),       '$quantity', 0] } },
    transferOut:     { $sum: { $cond: [cond('TRANSFER_OUT'),      '$quantity', 0] } },
    damage:          { $sum: { $cond: [cond('DAMAGE'),            '$quantity', 0] } },
    expired:         { $sum: { $cond: [cond('EXPIRED'),           '$quantity', 0] } },
    sample:          { $sum: { $cond: [cond('SAMPLE'),            '$quantity', 0] } },
    promotional:     { $sum: { $cond: [cond('PROMOTIONAL'),       '$quantity', 0] } },
    returnToCompany: { $sum: { $cond: [cond('RETURN_TO_COMPANY'), '$quantity', 0] } },
    adjustmentOut:   { $sum: { $cond: [cond('ADJUSTMENT_OUT'),    '$quantity', 0] } },
    // All-time closing stock — always unfiltered so it matches getClosingStock()
    _allIn:  { $sum: { $cond: [{ $in: ['$transactionType', INCOMING] }, '$quantity', 0] } },
    _allOut: { $sum: { $cond: [{ $in: ['$transactionType', OUTGOING] }, '$quantity', 0] } },
  };
};

const computedFields = {
  totalStock:     { $add: ['$openingStock', '$companyDispatch', '$transferIn', '$adjustmentIn'] },
  stockTransfers: { $add: ['$transferIn', '$transferOut'] },
  otherIssues:    { $add: ['$damage', '$expired', '$sample', '$promotional', '$returnToCompany'] },
  closingStock:   { $subtract: ['$_allIn', '$_allOut'] }, // always all-time
};

// ── getStockSummary ───────────────────────────────────────────────────────────
exports.getStockSummary = async (filters = {}) => {
  const { dealerId, productId, area, region, month, year } = filters;

  // No date filter on $match — we handle date in accumulators so closing stock stays all-time
  const match = {};
  if (dealerId && mongoose.isValidObjectId(dealerId))
    match.dealer = new mongoose.Types.ObjectId(dealerId);
  if (productId && mongoose.isValidObjectId(productId))
    match.product = new mongoose.Types.ObjectId(productId);

  let dateStart, dateEnd;
  if (month && year) {
    ({ start: dateStart, end: dateEnd } = monthRange(month, year));
  } else if (year) {
    const y = parseInt(year);
    dateStart = new Date(y, 0, 1);
    dateEnd   = new Date(y + 1, 0, 1);
  }

  const pipeline = [
    { $match: match },

    // Always join dealer for name + optional area/region filter
    {
      $lookup: {
        from: 'dealers',
        localField: 'dealer',
        foreignField: '_id',
        as: '_dealer',
      },
    },
    { $unwind: { path: '$_dealer', preserveNullAndEmptyArrays: false } },
    ...(area || region ? [{
      $match: {
        ...(area   ? { '_dealer.area':     area   } : {}),
        ...(region ? { '_dealer.province': region } : {}),
      },
    }] : []),

    // Join product for name
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: '_product',
      },
    },
    { $unwind: { path: '$_product', preserveNullAndEmptyArrays: false } },

    // Group by dealer+product
    {
      $group: {
        _id: { dealer: '$dealer', product: '$product' },
        dealerName:  { $first: '$_dealer.dealerName' },
        productName: { $first: '$_product.productName' },
        ...buildAccumulators(dateStart, dateEnd),
      },
    },

    { $addFields: computedFields },

    {
      $project: {
        _id: 0,
        dealerId:        '$_id.dealer',
        productId:       '$_id.product',
        dealerName:      1,
        productName:     1,
        openingStock:    1,
        companyDispatch: 1,
        transferIn:      1,
        adjustmentIn:    1,
        totalStock:      1,
        dealerSales:     1,
        transferOut:     1,
        stockTransfers:  1,
        otherIssues:     1,
        closingStock:    1,
      },
    },

    { $sort: { dealerName: 1, productName: 1 } },
  ];

  const products = await DealerStockTransaction.aggregate(pipeline);

  const summary = products.reduce(
    (acc, p) => ({
      openingStock:    acc.openingStock    + p.openingStock,
      companyDispatch: acc.companyDispatch + p.companyDispatch,
      totalStock:      acc.totalStock      + p.totalStock,
      dealerSales:     acc.dealerSales     + p.dealerSales,
      stockTransfers:  acc.stockTransfers  + p.stockTransfers,
      otherIssues:     acc.otherIssues     + p.otherIssues,
      closingStock:    acc.closingStock    + p.closingStock,
    }),
    { openingStock: 0, companyDispatch: 0, totalStock: 0, dealerSales: 0, stockTransfers: 0, otherIssues: 0, closingStock: 0 }
  );

  return { summary, products };
};

// ── getStockLedger ────────────────────────────────────────────────────────────
exports.getStockLedger = async (dealerId, productId, filters = {}) => {
  const { month, year } = filters;

  const match = {
    dealer:  new mongoose.Types.ObjectId(dealerId),
    product: new mongoose.Types.ObjectId(productId),
  };

  if (month && year) {
    const { start, end } = monthRange(month, year);
    match.transactionDate = { $gte: start, $lt: end };
  }

  const transactions = await DealerStockTransaction.find(match)
    .populate('createdBy', 'name')
    .sort({ transactionDate: 1, createdAt: 1 })
    .lean();

  let balance = 0;
  const ledger = transactions.map((tx) => {
    const isIn  = INCOMING.includes(tx.transactionType);
    const isOut = OUTGOING.includes(tx.transactionType);
    const stockIn  = isIn  ? tx.quantity : 0;
    const stockOut = isOut ? tx.quantity : 0;
    balance += stockIn - stockOut;
    return {
      date:            tx.transactionDate,
      transactionType: tx.transactionType,
      referenceType:   tx.referenceType || '—',
      referenceId:     tx.referenceId   || null,
      stockIn,
      stockOut,
      balance,
      remarks:         tx.remarks || tx.reason || '',
      createdBy:       tx.createdBy?.name || '—',
    };
  });

  return { ledger, closingBalance: balance };
};

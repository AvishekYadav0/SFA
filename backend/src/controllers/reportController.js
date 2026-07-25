const Order      = require('../models/Order');
const Collection = require('../models/Collection');
const Lifting    = require('../models/Lifting');
const Target     = require('../models/Target');
const Dealer     = require('../models/Dealer');
const mongoose   = require('mongoose');

const toId = (v) => new mongoose.Types.ObjectId(v);

// ── Shared filter builder ─────────────────────────────────────────────────────
const buildFilter = (q) => {
  const f = {};
  if (q.province)  f.province = q.province;
  if (q.staffId)   f.staffId  = toId(q.staffId);
  if (q.dealer)    f.dealer   = toId(q.dealer);
  if (q.status)    f.status   = q.status;
  if (q.startDate && q.endDate)
    f.date = { $gte: new Date(q.startDate), $lte: new Date(q.endDate) };
  return f;
};

// Scope filter for staff role
const scopeFilter = (f, user) => {
  if (user.role === 'staff') {
    if (user.province) f.province = user.province;
    f.staffId = user._id;
  }
  return f;
};

// ── 1. Sales Report ───────────────────────────────────────────────────────────
exports.salesReport = async (req, res) => {
  const filter = scopeFilter({ ...buildFilter(req.query), status: req.query.status || 'completed' }, req.user);
  if (req.query.product) filter['items.product'] = toId(req.query.product);
  const data = await Order.find(filter)
    .populate('staffId', 'name province')
    .populate({ path: 'dealer', select: 'dealerName area province', populate: { path: 'soleDealerId', select: 'name' } })
    .populate('salesperson', 'fullName')
    .populate('items.product', 'productName brand sku')
    .sort('-date');
  res.json({ success: true, data });
};

// ── 2. Collection Report ──────────────────────────────────────────────────────
exports.collectionReport = async (req, res) => {
  const filter = scopeFilter(buildFilter(req.query), req.user);
  if (req.query.month) filter.month = req.query.month;
  const data = await Collection.find(filter)
    .populate({ path: 'dealer', select: 'dealerName area province', populate: { path: 'soleDealerId', select: 'name' } })
    .populate('staffId', 'name province')
    .sort('-createdAt');
  res.json({ success: true, data });
};

// ── 3. Lifting Report ─────────────────────────────────────────────────────────
exports.liftingReport = async (req, res) => {
  const filter = scopeFilter(buildFilter(req.query), req.user);
  if (req.query.order) filter.order = toId(req.query.order);
  const data = await Lifting.find(filter)
    .populate('order', 'orderNumber')
    .populate({ path: 'dealer', select: 'dealerName area', populate: { path: 'soleDealerId', select: 'name' } })
    .populate('product', 'productName brand')
    .populate('staffId', 'name province')
    .sort('-createdAt');
  res.json({ success: true, data });
};

// ── 4. Dealer Outstanding ─────────────────────────────────────────────────────
exports.dealerOutstanding = async (req, res) => {
  const match = {};
  if (req.query.province) match.province = req.query.province;
  if (req.query.dealer)   match.dealer   = toId(req.query.dealer);
  if (req.user.role === 'staff' && req.user.province) match.province = req.user.province;
  const data = await Collection.aggregate([
    { $match: match },
    { $group: { _id: '$dealer', province: { $first: '$province' }, totalDue: { $sum: '$totalDue' }, totalCollection: { $sum: '$totalCollection' }, closingBalance: { $sum: '$closingBalance' } } },
    { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
    { $unwind: '$dealer' },
    { $lookup: { from: 'soledealers', localField: 'dealer.soleDealerId', foreignField: '_id', as: 'soleDealer' } },
    { $unwind: { path: '$soleDealer', preserveNullAndEmptyArrays: true } },
    { $project: { dealerName: '$dealer.dealerName', soleDealerName: { $ifNull: ['$soleDealer.name', '—'] }, area: '$dealer.area', province: 1, totalDue: 1, totalCollection: 1, closingBalance: 1 } },
    { $sort: { closingBalance: -1 } },
  ]);
  res.json({ success: true, data });
};

// ── 5. Salesperson Performance ────────────────────────────────────────────────
exports.salespersonPerformance = async (req, res) => {
  const match = { status: 'approved' };
  if (req.query.province)  match.province = req.query.province;
  if (req.query.staffId)   match.staffId  = toId(req.query.staffId);
  if (req.query.startDate && req.query.endDate)
    match.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
  if (req.user.role === 'staff') match.staffId = req.user._id;
  const data = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$staffId', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff' } },
    { $unwind: { path: '$staff', preserveNullAndEmpty: true } },
    { $project: { name: '$staff.name', province: '$staff.province', designation: '$staff.designation', totalSales: 1, orderCount: 1 } },
    { $sort: { totalSales: -1 } },
  ]);
  res.json({ success: true, data });
};

// ── 6. Product Wise Sales ─────────────────────────────────────────────────────
exports.productWiseSales = async (req, res) => {
  const match = { status: 'approved' };
  if (req.query.province) match.province = req.query.province;
  if (req.user.role === 'staff' && req.user.province) match.province = req.user.province;
  if (req.query.startDate && req.query.endDate)
    match.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
  const data = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', productName: { $first: '$items.productName' }, totalQty: { $sum: '$items.quantity' }, totalAmount: { $sum: '$items.grandTotal' } } },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmpty: true } },
    { $project: { productName: { $ifNull: ['$product.productName', '$productName'] }, brand: '$product.brand', category: '$product.category', sku: '$product.sku', totalQty: 1, totalAmount: 1 } },
    { $sort: { totalAmount: -1 } },
  ]);
  res.json({ success: true, data });
};

// ── 7. Province Wise Sales ────────────────────────────────────────────────────
exports.provinceWiseSales = async (req, res) => {
  const match = { status: 'completed' };
  if (req.user.role === 'staff' && req.user.province) match.province = req.user.province;
  const data = await Order.aggregate([
    { $match: match },
    { $group: {
      _id: '$province',
      totalSales: { $sum: '$grandTotal' },
      totalCollected: { $sum: '$collectedAmount' },
      orderCount: { $sum: 1 },
      cash:    { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] },    '$collectedAmount', 0] } },
      bank:    { $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank'] },    '$collectedAmount', 0] } },
      esewa:   { $sum: { $cond: [{ $eq: ['$paymentMethod', 'esewa'] },   '$collectedAmount', 0] } },
      fonepay: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'fonepay'] }, '$collectedAmount', 0] } },
      cheque:  { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cheque'] },  '$collectedAmount', 0] } },
      credit:  { $sum: { $cond: [{ $eq: ['$paymentMethod', 'credit'] },  '$collectedAmount', 0] } },
    }},
    { $sort: { totalSales: -1 } },
  ]);
  res.json({ success: true, data });
};

// ── 8. Monthly Sales ──────────────────────────────────────────────────────────
exports.monthlySalesReport = async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const match = { status: 'approved', date: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) } };
  if (req.query.province) match.province = req.query.province;
  if (req.user.role === 'staff') {
    if (req.user.province) match.province = req.user.province;
    match.staffId = req.user._id;
  }
  const data = await Order.aggregate([
    { $match: match },
    { $group: { _id: { month: { $month: '$date' } }, totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 }, totalBasic: { $sum: '$totalBasicAmount' }, totalExcise: { $sum: '$totalExciseAmount' }, totalVat: { $sum: '$totalVatAmount' } } },
    { $sort: { '_id.month': 1 } },
  ]);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const result = months.map((name, i) => {
    const found = data.find(d => d._id.month === i + 1);
    return { month: name, totalSales: found?.totalSales || 0, orderCount: found?.orderCount || 0, totalBasic: found?.totalBasic || 0, totalExcise: found?.totalExcise || 0, totalVat: found?.totalVat || 0 };
  });
  res.json({ success: true, data: result });
};

// ── 9. Target vs Achievement ──────────────────────────────────────────────────
exports.targetVsAchievement = async (req, res) => {
  const { period = 'monthly', month, year = new Date().getFullYear(), province } = req.query;
  const targetFilter = { period };
  if (month)    targetFilter.month    = month;
  if (year)     targetFilter.year     = parseInt(year);
  if (province) targetFilter.province = province;
  if (req.user.role === 'staff') targetFilter.staffId = req.user._id;

  const targets = await Target.find(targetFilter).populate('staffId', 'name province designation');

  let dateRange = {};
  if (period === 'monthly' && month) {
    const [y, m] = month.split('-').map(Number);
    dateRange = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
  } else if (period === 'yearly') {
    dateRange = { $gte: new Date(parseInt(year), 0, 1), $lte: new Date(parseInt(year), 11, 31) };
  }

  const result = await Promise.all(targets.map(async (t) => {
    const orderMatch = { status: 'approved', staffId: t.staffId?._id };
    const collMatch  = { staffId: t.staffId?._id };
    if (dateRange.$gte) { orderMatch.date = dateRange; }

    const [salesAgg, collAgg] = await Promise.all([
      Order.aggregate([{ $match: orderMatch }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Collection.aggregate([{ $match: collMatch }, { $group: { _id: null, total: { $sum: '$totalCollection' } } }]),
    ]);

    const salesAchieved = salesAgg[0]?.total || 0;
    const collAchieved  = collAgg[0]?.total  || 0;
    const salesPct      = t.salesTarget > 0 ? Math.round((salesAchieved / t.salesTarget) * 100) : 0;
    const collPct       = t.collectionTarget > 0 ? Math.round((collAchieved / t.collectionTarget) * 100) : 0;

    return {
      _id: t._id, staffName: t.staffId?.name || '—',
      province: t.staffId?.province || t.province,
      designation: t.staffId?.designation,
      period: t.period, month: t.month, year: t.year,
      salesTarget: t.salesTarget, collectionTarget: t.collectionTarget,
      salesAchieved, collAchieved, salesPct, collPct,
      salesBalance: Math.max(0, t.salesTarget - salesAchieved),
      collBalance:  Math.max(0, t.collectionTarget - collAchieved),
    };
  }));

  res.json({ success: true, data: result });
};

// ── 10. Order Status Report ───────────────────────────────────────────────────
exports.orderStatusReport = async (req, res) => {
  const filter = scopeFilter(buildFilter(req.query), req.user);
  delete filter.status;
  if (req.query.status) filter.status = req.query.status;
  const data = await Order.find(filter)
    .populate('staffId', 'name province')
    .populate({ path: 'dealer', select: 'dealerName area', populate: { path: 'soleDealerId', select: 'name' } })
    .populate('salesperson', 'fullName')
    .sort('-date');
  res.json({ success: true, data });
};

// ── 11. Collection Ageing ─────────────────────────────────────────────────────
exports.collectionAgeing = async (req, res) => {
  const match = {};
  if (req.query.province) match.province = req.query.province;
  if (req.user.role === 'staff' && req.user.province) match.province = req.user.province;
  const collections = await Collection.find({ ...match, closingBalance: { $gt: 0 } })
    .populate({ path: 'dealer', select: 'dealerName area', populate: { path: 'soleDealerId', select: 'name' } })
    .populate('staffId', 'name')
    .sort('-createdAt');

  const now = new Date();
  const data = collections.map(c => {
    const days = Math.floor((now - new Date(c.createdAt)) / (1000 * 60 * 60 * 24));
    let bucket = '0-30 days';
    if (days > 90)      bucket = '90+ days';
    else if (days > 60) bucket = '61-90 days';
    else if (days > 30) bucket = '31-60 days';
    return {
      dealerName:     c.dealer?.dealerName,
      soleDealerName: c.dealer?.soleDealerId?.name || '—',
      area:           c.dealer?.area,
      staffName:      c.staffId?.name,
      month:          c.month,
      closingBalance: c.closingBalance,
      daysOverdue:    days,
      bucket,
    };
  });
  res.json({ success: true, data });
};

// ── 12. Dealer Performance ────────────────────────────────────────────────────
exports.dealerPerformance = async (req, res) => {
  const match = { status: 'approved' };
  if (req.query.province) match.province = req.query.province;
  if (req.user.role === 'staff' && req.user.province) match.province = req.user.province;
  if (req.query.startDate && req.query.endDate)
    match.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

  const data = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$dealer', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 }, lastOrder: { $max: '$date' } } },
    { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
    { $unwind: '$dealer' },
    { $lookup: { from: 'soledealers', localField: 'dealer.soleDealerId', foreignField: '_id', as: 'soleDealer' } },
    { $unwind: { path: '$soleDealer', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'collections', localField: '_id', foreignField: 'dealer', as: 'collections' } },
    { $addFields: { totalCollection: { $sum: '$collections.totalCollection' }, outstanding: { $sum: '$collections.closingBalance' } } },
    { $project: { dealerName: '$dealer.dealerName', soleDealerName: { $ifNull: ['$soleDealer.name', '—'] }, area: '$dealer.area', province: '$dealer.province', status: '$dealer.status', totalSales: 1, orderCount: 1, lastOrder: 1, totalCollection: 1, outstanding: 1 } },
    { $sort: { totalSales: -1 } },
  ]);
  res.json({ success: true, data });
};

// ── 13. Dealer Hierarchy (Sole Dealer → Dealer rollup) ────────────────────────
exports.dealerHierarchy = async (req, res) => {
  const match = { status: 'approved' };
  if (req.query.province) match.province = req.query.province;
  if (req.user.role === 'staff' && req.user.province) match.province = req.user.province;
  if (req.query.startDate && req.query.endDate)
    match.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

  const data = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$dealer', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 } } },
    { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
    { $unwind: '$dealer' },
    { $lookup: { from: 'soledealers', localField: 'dealer.soleDealerId', foreignField: '_id', as: 'soleDealer' } },
    { $unwind: { path: '$soleDealer', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'collections', localField: '_id', foreignField: 'dealer', as: 'collections' } },
    { $addFields: { totalCollection: { $sum: '$collections.totalCollection' }, outstanding: { $sum: '$collections.closingBalance' } } },
    { $project: {
      soleDealerName: { $ifNull: ['$soleDealer.name', '—'] },
      dealerName: '$dealer.dealerName',
      area: '$dealer.area',
      province: '$dealer.province',
      orderCount: 1, totalSales: 1, totalCollection: 1, outstanding: 1,
    }},
    { $sort: { soleDealerName: 1, totalSales: -1 } },
  ]);
  res.json({ success: true, data });
};

// ── 14. Staff Hierarchy (Manager-wise) ────────────────────────────────────────
exports.staffHierarchy = async (req, res) => {
  const Salesperson = require('../models/Salesperson');
  const match = { status: 'approved' };
  if (req.query.province) match.province = req.query.province;
  if (req.user.role === 'staff' && req.user.province) match.province = req.user.province;
  if (req.query.startDate && req.query.endDate)
    match.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

  const salesAgg = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$salesperson', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 } } },
  ]);

  const allSP = await Salesperson.find().populate('reportsTo', 'fullName designation');
  const salesMap = {};
  salesAgg.forEach(s => { salesMap[String(s._id)] = s; });

  const data = allSP.map(sp => ({
    _id: sp._id,
    name: sp.fullName,
    designation: sp.designation,
    province: sp.province,
    area: sp.area,
    managerName: sp.reportsTo?.fullName || '—',
    managerDesignation: sp.reportsTo?.designation || '—',
    orderCount: salesMap[String(sp._id)]?.orderCount || 0,
    totalSales: salesMap[String(sp._id)]?.totalSales || 0,
  }));

  res.json({ success: true, data });
};

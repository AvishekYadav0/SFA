const Order      = require('../models/Order');
const Collection = require('../models/Collection');
const Visit      = require('../models/Visit');
const Dealer     = require('../models/Dealer');
const User       = require('../models/User');
const Target     = require('../models/Target');
const { scopeFilter } = require('../middleware/auth');

const dealerScope = (req) => scopeFilter(req, 'dealer');

const buildDateFilter = (req) => {
  const f = {};
  let start;
  let end;
  if (req.query.startDate) start = new Date(req.query.startDate);
  if (req.query.endDate) {
    end = new Date(req.query.endDate);
    end.setHours(23, 59, 59, 999);
  }
  if (!start && !end && req.query.range && req.query.range !== 'all') {
    const now = new Date();
    end = now;
    start = new Date(now);
    if (req.query.range === 'day') start.setHours(0, 0, 0, 0);
    if (req.query.range === 'week') {
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
    }
    if (req.query.range === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (req.query.range === 'year') start = new Date(now.getFullYear(), 0, 1);
  }
  if (start || end) f.date = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
  return f;
};

exports.salesReport = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const dateF = buildDateFilter(req);
    const filter = { ...scope, ...dateF, status: { $nin: ['cancelled'] } };
    if (req.query.province) filter.province = req.query.province;
    if (req.query.se)       filter.se       = req.query.se;
    if (req.query.asm)      filter.asm      = req.query.asm;

    const [summary, byProvince, bySE, byDealer, byProduct, rows] = await Promise.all([
      Order.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, avgOrder: { $avg: '$grandTotal' } } }]),
      Order.aggregate([{ $match: filter }, { $group: { _id: '$province', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Order.aggregate([
        { $match: filter },
        { $group: { _id: '$se', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]),
      Order.aggregate([
        { $match: filter },
        { $group: { _id: '$dealer', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }, { $limit: 20 },
        { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
        { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
      ]),
      Order.aggregate([
        { $match: filter },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', total: { $sum: '$items.grandTotal' }, qty: { $sum: '$items.quantity' } } },
        { $sort: { total: -1 } }, { $limit: 20 },
      ]),
      Order.find(filter)
        .populate('dealer', 'dealerName area province')
        .populate('se', 'name fullName')
        .sort('-date')
        .lean(),
    ]);

    res.json({ success: true, data: rows, summary: summary[0] || {}, byProvince, bySE, byDealer, byProduct });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.collectionReport = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const dateF = buildDateFilter(req);
    const filter = { ...scope, ...dateF };
    if (req.query.province) filter.province = req.query.province;
    if (req.query.se)       filter.se       = req.query.se;

    const [summary, byProvince, bySE, byDealer, trend, rows] = await Promise.all([
      Collection.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Collection.aggregate([{ $match: filter }, { $group: { _id: '$province', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }]),
      Collection.aggregate([
        { $match: filter },
        { $group: { _id: '$se', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]),
      Collection.aggregate([
        { $match: filter },
        { $group: { _id: '$dealer', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } }, { $limit: 20 },
        { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
        { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
      ]),
      Collection.aggregate([
        { $match: filter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      Collection.find(filter)
        .populate('dealer', 'dealerName area province')
        .sort('-date')
        .lean(),
    ]);

    res.json({ success: true, data: rows, summary: summary[0] || {}, byProvince, bySE, byDealer, trend });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.visitReport = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const dateF = buildDateFilter(req);
    const filter = { ...scope, ...dateF };
    if (req.query.se) filter.se = req.query.se;

    const [summary, bySE, byDealer] = await Promise.all([
      Visit.aggregate([{ $match: filter }, { $group: { _id: null, count: { $sum: 1 } } }]),
      Visit.aggregate([
        { $match: filter },
        { $group: { _id: '$se', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]),
      Visit.aggregate([
        { $match: filter },
        { $group: { _id: '$dealer', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 20 },
        { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
        { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    res.json({ success: true, data: { summary: summary[0] || {}, bySE, byDealer } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.outstandingReport = async (req, res) => {
  try {
    const filter = { ...dealerScope(req), outstandingAmount: { $gt: 0 } };
    if (req.query.province) filter.province = req.query.province;
    const data = await Dealer.find(filter)
      .populate('se', 'name')
      .sort('-outstandingAmount')
      .limit(100);
    const total = await Dealer.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$outstandingAmount' } } }]);
    res.json({ success: true, data, totalOutstanding: total[0]?.total || 0 });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.targetAchievement = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const now   = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 0, 23, 59, 59);

    const userFilter = { role: { $ne: 'admin' } };
    if (req.query.role) userFilter.role = req.query.role;
    // Scope user list to hierarchy
    const { role: myRole, _id } = req.user;
    if (myRole === 'rsm')  userFilter.rsm = _id;
    if (myRole === 'asm')  userFilter.asm = _id;
    if (myRole === 'se')   userFilter.reportsTo = _id;  // SE sees their SOs
    if (myRole === 'so')   userFilter._id = _id;        // SO sees only self

    const users   = await User.find(userFilter).select('name role employeeId province area target').lean();
    const targets = await Target.find({ month, year }).lean();
    const targetMap = {};
    targets.forEach(t => { targetMap[String(t.user)] = t; });

    const salesAgg = await Order.aggregate([
      { $match: { ...scope, date: { $gte: monthStart, $lte: monthEnd }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: '$se', total: { $sum: '$grandTotal' } } },
    ]);
    const salesMap = {};
    salesAgg.forEach(s => { salesMap[String(s._id)] = s.total; });

    const collAgg = await Collection.aggregate([
      { $match: { ...scope, date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: '$se', total: { $sum: '$amount' } } },
    ]);
    const collMap = {};
    collAgg.forEach(c => { collMap[String(c._id)] = c.total; });

    const data = users.map(u => {
      const t   = targetMap[String(u._id)] || {};
      const st  = t.salesTarget      || u.target || 0;
      const ct  = t.collectionTarget || 0;
      const sa  = salesMap[String(u._id)] || 0;
      const ca  = collMap[String(u._id)]  || 0;
      return {
        _id: u._id, name: u.name, role: u.role, employeeId: u.employeeId,
        province: u.province, area: u.area,
        salesTarget: st, salesAchieved: sa,
        salesPct: st > 0 ? Math.round((sa / st) * 100) : null,
        collectionTarget: ct, collectionAchieved: ca,
        collectionPct: ct > 0 ? Math.round((ca / ct) * 100) : null,
      };
    });

    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Aliases for routes/reports.js naming convention
exports.liftingReport          = exports.salesReport;       // placeholder — lifting uses same sales scope
exports.dealerOutstanding      = exports.outstandingReport;
exports.salespersonPerformance = exports.targetAchievement;
exports.productWiseSales = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const dateF = buildDateFilter(req);
    const data = await Order.aggregate([
      { $match: { ...scope, ...dateF, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productName', total: { $sum: '$items.grandTotal' }, qty: { $sum: '$items.quantity' }, orders: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.provinceWiseSales = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const dateF = buildDateFilter(req);
    const data = await Order.aggregate([
      { $match: { ...scope, ...dateF, status: { $nin: ['cancelled'] } } },
      { $group: { _id: '$province', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.monthlySalesReport = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const year  = parseInt(req.query.year) || new Date().getFullYear();
    const data  = await Order.aggregate([
      { $match: { ...scope, date: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: { $month: '$date' }, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.orderStatus = async (req, res) => {
  try {
    const filter = { ...scopeFilter(req), ...buildDateFilter(req) };
    if (req.query.status) filter.status = req.query.status;
    const data = await Order.find(filter)
      .populate('dealer', 'dealerName')
      .populate('se', 'name fullName')
      .sort('-date')
      .lean();
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.targetVsAchievement = exports.targetAchievement;
exports.collectionAgeing = async (req, res) => {
  try {
    const filter = { ...scopeFilter(req, 'dealer'), outstandingAmount: { $gt: 0 } };
    const now = new Date();
    const data = await Dealer.find(filter).populate('se', 'name').lean();
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    data.forEach(d => {
      const days = d.lastOrderDate ? Math.floor((now - d.lastOrderDate) / 86400000) : 999;
      if (days <= 30) buckets['0-30'] += d.outstandingAmount;
      else if (days <= 60) buckets['31-60'] += d.outstandingAmount;
      else if (days <= 90) buckets['61-90'] += d.outstandingAmount;
      else buckets['90+'] += d.outstandingAmount;
    });
    res.json({ success: true, data, buckets });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.dealerPerformance = async (req, res) => {
  try {
    const scope = scopeFilter(req, 'dealer');
    const now   = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const data = await Dealer.find(scope).populate('se', 'name').lean();
    const salesAgg = await Order.aggregate([
      { $match: { ...scopeFilter(req), date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: '$dealer', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]);
    const salesMap = {};
    salesAgg.forEach(s => { salesMap[String(s._id)] = s; });
    const result = data.map(d => ({ ...d, monthlySales: salesMap[String(d._id)]?.total || 0, monthlyOrders: salesMap[String(d._id)]?.count || 0 }));
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.dealerHierarchy = async (req, res) => {
  try {
    const scope = scopeFilter(req, 'dealer');
    const dateF = buildDateFilter(req);
    const dealerFilter = { ...scope };
    if (req.query.province) dealerFilter.province = req.query.province;
    if (req.query.region) dealerFilter.region = req.query.region;
    const data  = await Dealer.find(dealerFilter)
      .populate('se', 'name employeeId')
      .populate('asm', 'name')
      .populate('rsm', 'name')
      .select('dealerName dealerCode distributor area region province se asm rsm nsm status outstandingAmount')
      .lean();
    const dealerIds = data.map((dealer) => dealer._id);
    const [sales, collections] = await Promise.all([
      Order.aggregate([
        { $match: { ...scopeFilter(req), ...dateF, dealer: { $in: dealerIds }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: '$dealer', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 } } },
      ]),
      Collection.aggregate([
        { $match: { ...scopeFilter(req), ...dateF, dealer: { $in: dealerIds } } },
        { $group: { _id: '$dealer', totalCollection: { $sum: '$amount' } } },
      ]),
    ]);
    const salesByDealer = Object.fromEntries(sales.map((row) => [String(row._id), row]));
    const collectionsByDealer = Object.fromEntries(collections.map((row) => [String(row._id), row]));
    const result = data.map((dealer) => ({
      ...dealer,
      soleDealerName: dealer.distributor,
      orderCount: salesByDealer[String(dealer._id)]?.orderCount || 0,
      totalSales: salesByDealer[String(dealer._id)]?.totalSales || 0,
      totalCollection: collectionsByDealer[String(dealer._id)]?.totalCollection || 0,
      outstanding: dealer.outstandingAmount || 0,
    }));
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.staffHierarchy = async (req, res) => {
  try {
    const { userScopeFilter } = require('../middleware/auth');
    const scope = userScopeFilter(req);
    const dateF = buildDateFilter(req);
    const data  = await User.find({ ...scope, role: { $nin: ['admin', 'dealer'] } })
      .populate('reportsTo', 'name role')
      .populate('asm rsm nsm', 'name')
      .select('name employeeId role area region province status reportsTo asm rsm nsm')
      .lean();
    const staffIds = data.map((staff) => staff._id);
    const performance = await Order.aggregate([
      { $match: { ...scopeFilter(req), ...dateF, status: { $nin: ['cancelled'] } } },
      { $project: { staffId: { $ifNull: ['$so', '$se'] }, grandTotal: 1 } },
      { $match: { staffId: { $in: staffIds } } },
      { $group: { _id: '$staffId', orderCount: { $sum: 1 }, totalSales: { $sum: '$grandTotal' } } },
    ]);
    const performanceByStaff = Object.fromEntries(performance.map((row) => [String(row._id), row]));
    const roleLabels = { nsm: 'National Sales Manager', rsm: 'Regional Sales Manager', asm: 'Area Sales Manager', se: 'Sales Executive', so: 'Marketing Staff' };
    const result = data.map((staff) => ({
      ...staff,
      designation: roleLabels[staff.role] || staff.role,
      orderCount: performanceByStaff[String(staff._id)]?.orderCount || 0,
      totalSales: performanceByStaff[String(staff._id)]?.totalSales || 0,
    }));
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Stock Reports ────────────────────────────────────────────────────────────
const DealerStockTransaction  = require('../models/DealerStockTransaction');
const DealerProductStockSetting = require('../models/DealerProductStockSetting');

// Safe date filter for stock reports — handles empty strings and range param
const buildStockDateFilter = (req) => {
  const { startDate, endDate, range } = req.query;
  const start = startDate && startDate.trim() ? new Date(startDate) : null;
  let   end   = endDate   && endDate.trim()   ? new Date(endDate)   : null;
  if (end) end.setHours(23, 59, 59, 999);

  // If explicit dates given and valid, use them
  if (start && !isNaN(start) && end && !isNaN(end)) return { $gte: start, $lte: end };
  if (start && !isNaN(start)) return { $gte: start };
  if (end   && !isNaN(end))   return { $lte: end };

  // Fall back to range
  if (!range || range === 'all') return null;
  const now  = new Date();
  const from = new Date(now);
  if (range === 'day')   { from.setHours(0, 0, 0, 0); }
  if (range === 'week')  { from.setDate(now.getDate() - now.getDay()); from.setHours(0, 0, 0, 0); }
  if (range === 'month') { from.setDate(1); from.setHours(0, 0, 0, 0); }
  if (range === 'year')  { from.setMonth(0, 1); from.setHours(0, 0, 0, 0); }
  return { $gte: from, $lte: now };
};

const INCOMING_TX = ['OPENING', 'COMPANY_DISPATCH', 'TRANSFER_IN', 'ADJUSTMENT_IN'];
const OUTGOING_TX = ['DEALER_SALE', 'TRANSFER_OUT', 'DAMAGE', 'EXPIRED', 'SAMPLE', 'PROMOTIONAL', 'RETURN_TO_COMPANY', 'ADJUSTMENT_OUT'];

const stockAccumulators = () => ({
  openingStock:    { $sum: { $cond: [{ $eq: ['$transactionType', 'OPENING']           }, '$quantity', 0] } },
  companyDispatch: { $sum: { $cond: [{ $eq: ['$transactionType', 'COMPANY_DISPATCH']  }, '$quantity', 0] } },
  transferIn:      { $sum: { $cond: [{ $eq: ['$transactionType', 'TRANSFER_IN']       }, '$quantity', 0] } },
  adjustmentIn:    { $sum: { $cond: [{ $eq: ['$transactionType', 'ADJUSTMENT_IN']     }, '$quantity', 0] } },
  dealerSales:     { $sum: { $cond: [{ $eq: ['$transactionType', 'DEALER_SALE']       }, '$quantity', 0] } },
  transferOut:     { $sum: { $cond: [{ $eq: ['$transactionType', 'TRANSFER_OUT']      }, '$quantity', 0] } },
  damage:          { $sum: { $cond: [{ $eq: ['$transactionType', 'DAMAGE']            }, '$quantity', 0] } },
  expired:         { $sum: { $cond: [{ $eq: ['$transactionType', 'EXPIRED']           }, '$quantity', 0] } },
  sample:          { $sum: { $cond: [{ $eq: ['$transactionType', 'SAMPLE']            }, '$quantity', 0] } },
  promotional:     { $sum: { $cond: [{ $eq: ['$transactionType', 'PROMOTIONAL']       }, '$quantity', 0] } },
  returnToCompany: { $sum: { $cond: [{ $eq: ['$transactionType', 'RETURN_TO_COMPANY'] }, '$quantity', 0] } },
  adjustmentOut:   { $sum: { $cond: [{ $eq: ['$transactionType', 'ADJUSTMENT_OUT']    }, '$quantity', 0] } },
});

const closingStockExpr = {
  $subtract: [
    { $add: ['$openingStock', '$companyDispatch', '$transferIn', '$adjustmentIn'] },
    { $add: ['$dealerSales', '$transferOut', '$damage', '$expired', '$sample', '$promotional', '$returnToCompany', '$adjustmentOut'] },
  ],
};

// GET /api/reports/dealer-stock  — current closing stock per dealer+product
exports.dealerStockReport = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const match = {};
    if (req.user.role === 'dealer' && req.user.linkedDealer)
      match.dealer = req.user.linkedDealer;
    else if (req.query.dealerId && mongoose.isValidObjectId(req.query.dealerId))
      match.dealer = new mongoose.Types.ObjectId(req.query.dealerId);
    if (req.query.productId && mongoose.isValidObjectId(req.query.productId))
      match.product = new mongoose.Types.ObjectId(req.query.productId);

    const data = await DealerStockTransaction.aggregate([
      { $match: match },
      { $group: { _id: { dealer: '$dealer', product: '$product' }, ...stockAccumulators() } },
      { $addFields: { closingStock: closingStockExpr } },
      { $lookup: { from: 'dealers',  localField: '_id.dealer',  foreignField: '_id', as: '_dealer'  } },
      { $lookup: { from: 'products', localField: '_id.product', foreignField: '_id', as: '_product' } },
      { $unwind: { path: '$_dealer',  preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$_product', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0,
        dealerId:        '$_id.dealer',
        productId:       '$_id.product',
        dealerName:      '$_dealer.dealerName',
        area:            '$_dealer.area',
        province:        '$_dealer.province',
        productName:     '$_product.productName',
        openingStock: 1, companyDispatch: 1, transferIn: 1, adjustmentIn: 1,
        dealerSales: 1,  transferOut: 1,    damage: 1,     expired: 1,
        sample: 1,       promotional: 1,    returnToCompany: 1, adjustmentOut: 1,
        closingStock: 1,
      }},
      { $sort: { dealerName: 1, productName: 1 } },
    ]);

    // Attach minimumStock from settings
    const settings = await DealerProductStockSetting.find({}).lean();
    const settingMap = {};
    settings.forEach(s => { settingMap[`${s.dealer}_${s.product}`] = s.minimumStock; });

    const result = data.map(row => {
      const minStock = settingMap[`${row.dealerId}_${row.productId}`] ?? 0;
      const closing  = row.closingStock;
      const stockStatus = closing <= 0 ? 'Out of Stock' : closing <= minStock ? 'Low Stock' : 'Healthy';
      return { ...row, minimumStock: minStock, stockStatus };
    });

    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/reports/stock-movement  — transaction-level movement report
exports.stockMovementReport = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const match = {};
    if (req.user.role === 'dealer' && req.user.linkedDealer)
      match.dealer = req.user.linkedDealer;
    else if (req.query.dealerId && mongoose.isValidObjectId(req.query.dealerId))
      match.dealer = new mongoose.Types.ObjectId(req.query.dealerId);
    if (req.query.productId && mongoose.isValidObjectId(req.query.productId))
      match.product = new mongoose.Types.ObjectId(req.query.productId);
    if (req.query.transactionType) match.transactionType = req.query.transactionType;
    const dateMatch = buildStockDateFilter(req);
    if (dateMatch) match.transactionDate = dateMatch;
    const data = await DealerStockTransaction.find(match)
      .populate('dealer',    'dealerName area province')
      .populate('product',   'productName')
      .populate('createdBy', 'name')
      .sort({ transactionDate: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/reports/low-stock  — products below minimumStock
exports.lowStockReport = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const allTx = await DealerStockTransaction.aggregate([
      { $group: { _id: { dealer: '$dealer', product: '$product' }, ...stockAccumulators() } },
      { $addFields: { closingStock: closingStockExpr } },
    ]);

    const settings = await DealerProductStockSetting.find({ minimumStock: { $gt: 0 } }).lean();
    const settingMap = {};
    settings.forEach(s => { settingMap[`${s.dealer}_${s.product}`] = s.minimumStock; });

    const stockMap = {};
    allTx.forEach(r => { stockMap[`${r._id.dealer}_${r._id.product}`] = { ...r._id, closingStock: r.closingStock }; });

    const lowItems = settings
      .map(s => {
        const key     = `${s.dealer}_${s.product}`;
        const closing = stockMap[key]?.closingStock ?? 0;
        return { dealer: s.dealer, product: s.product, minimumStock: s.minimumStock, closingStock: closing };
      })
      .filter(r => r.closingStock <= r.minimumStock);

    if (!lowItems.length) return res.json({ success: true, data: [] });

    const dealerIds  = [...new Set(lowItems.map(r => r.dealer))];
    const productIds = [...new Set(lowItems.map(r => r.product))];
    const [dealers, products] = await Promise.all([
      Dealer.find({ _id: { $in: dealerIds } }).select('dealerName area province').lean(),
      require('../models/Product').find({ _id: { $in: productIds } }).select('productName').lean(),
    ]);
    const dMap = Object.fromEntries(dealers.map(d  => [String(d._id),  d]));
    const pMap = Object.fromEntries(products.map(p => [String(p._id),  p]));

    const result = lowItems.map(r => ({
      dealerId:    r.dealer,
      productId:   r.product,
      dealerName:  dMap[String(r.dealer)]?.dealerName  || '—',
      area:        dMap[String(r.dealer)]?.area        || '—',
      province:    dMap[String(r.dealer)]?.province    || '—',
      productName: pMap[String(r.product)]?.productName || '—',
      minimumStock: r.minimumStock,
      closingStock: r.closingStock,
      stockStatus:  r.closingStock <= 0 ? 'Out of Stock' : 'Low Stock',
    }));

    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/reports/dealer-sales-stock  — dealer sales transactions
exports.dealerSalesStockReport = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const match = { transactionType: 'DEALER_SALE' };

    // Scope to dealer's own data if role is dealer
    if (req.user.role === 'dealer' && req.user.linkedDealer)
      match.dealer = req.user.linkedDealer;
    else if (req.query.dealerId && mongoose.isValidObjectId(req.query.dealerId))
      match.dealer = new mongoose.Types.ObjectId(req.query.dealerId);

    if (req.query.productId && mongoose.isValidObjectId(req.query.productId))
      match.product = new mongoose.Types.ObjectId(req.query.productId);

    const dateMatch = buildStockDateFilter(req);
    if (dateMatch) match.transactionDate = dateMatch;

    const data = await DealerStockTransaction.find(match)
      .populate('dealer',    'dealerName area province')
      .populate('product',   'productName')
      .populate('createdBy', 'name')
      .sort({ transactionDate: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/reports/damage-expiry  — damage/expired/sample transactions
exports.damageExpiryReport = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const DAMAGE_TYPES = ['DAMAGE', 'EXPIRED', 'SAMPLE', 'PROMOTIONAL', 'RETURN_TO_COMPANY'];
    const match = { transactionType: { $in: DAMAGE_TYPES } };
    if (req.user.role === 'dealer' && req.user.linkedDealer)
      match.dealer = req.user.linkedDealer;
    else if (req.query.dealerId && mongoose.isValidObjectId(req.query.dealerId))
      match.dealer = new mongoose.Types.ObjectId(req.query.dealerId);
    if (req.query.transactionType && DAMAGE_TYPES.includes(req.query.transactionType))
      match.transactionType = req.query.transactionType;
    const dateMatch = buildStockDateFilter(req);
    if (dateMatch) match.transactionDate = dateMatch;
    const data = await DealerStockTransaction.find(match)
      .populate('dealer',    'dealerName area province')
      .populate('product',   'productName')
      .populate('createdBy', 'name')
      .sort({ transactionDate: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.dealerStats = async (req, res) => {
  try {
    const { id } = req.params;
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    const dealer = await Dealer.findById(id).populate('se asm rsm', 'name phone employeeId');
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });

    const [monthlyPurchase, yearlyPurchase, totalOrders, pendingOrders, cancelledOrders,
           topProducts, paymentHistory, visitHistory, recentOrders] = await Promise.all([
      Order.aggregate([{ $match: { dealer: dealer._id, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.aggregate([{ $match: { dealer: dealer._id, date: { $gte: yearStart },  status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.countDocuments({ dealer: dealer._id }),
      Order.countDocuments({ dealer: dealer._id, status: 'pending' }),
      Order.countDocuments({ dealer: dealer._id, status: 'cancelled' }),
      Order.aggregate([
        { $match: { dealer: dealer._id, status: { $nin: ['cancelled'] } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', total: { $sum: '$items.grandTotal' }, qty: { $sum: '$items.quantity' } } },
        { $sort: { total: -1 } }, { $limit: 10 },
      ]),
      Collection.find({ dealer: dealer._id }).sort('-date').limit(20).lean(),
      Visit.find({ dealer: dealer._id }).sort('-date').limit(20).populate('se', 'name').lean(),
      Order.find({ dealer: dealer._id }).sort('-date').limit(10).lean(),
    ]);

    const avgOrderValue = totalOrders > 0
      ? (yearlyPurchase[0]?.total || 0) / totalOrders
      : 0;

    res.json({
      success: true,
      data: {
        dealer,
        monthlyPurchase: monthlyPurchase[0]?.total || 0,
        yearlyPurchase:  yearlyPurchase[0]?.total  || 0,
        totalOrders, pendingOrders, cancelledOrders,
        avgOrderValue,
        availableCredit: dealer.creditLimit - dealer.outstandingAmount,
        topProducts, paymentHistory, visitHistory, recentOrders,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

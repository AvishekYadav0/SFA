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
  if (req.query.startDate && req.query.endDate)
    f.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
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

    const [summary, byProvince, bySE, byDealer, byProduct] = await Promise.all([
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
    ]);

    res.json({ success: true, data: { summary: summary[0] || {}, byProvince, bySE, byDealer, byProduct } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.collectionReport = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const dateF = buildDateFilter(req);
    const filter = { ...scope, ...dateF };
    if (req.query.province) filter.province = req.query.province;
    if (req.query.se)       filter.se       = req.query.se;

    const [summary, byProvince, bySE, byDealer, trend] = await Promise.all([
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
    ]);

    res.json({ success: true, data: { summary: summary[0] || {}, byProvince, bySE, byDealer, trend } });
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
    const data  = await Dealer.find(scope)
      .populate('se', 'name employeeId')
      .populate('asm', 'name')
      .populate('rsm', 'name')
      .select('dealerName dealerCode area region province se asm rsm status outstandingAmount')
      .lean();
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
exports.staffHierarchy = async (req, res) => {
  try {
    const { userScopeFilter } = require('../middleware/auth');
    const scope = userScopeFilter(req);
    const data  = await User.find({ ...scope, role: { $nin: ['admin', 'dealer'] } })
      .populate('reportsTo', 'name role')
      .populate('asm rsm nsm', 'name')
      .select('name employeeId role area region province status reportsTo asm rsm nsm')
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
